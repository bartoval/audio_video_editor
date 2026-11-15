// Package scenes finds the cuts of a video with the algorithm of
// PySceneDetect's ContentDetector (0.7): the score of a frame is the mean
// absolute difference of its hue, saturation and value from the previous
// frame, on frames about 256 pixels wide; a cut is a score at or above the
// threshold, and cuts closer than the minimum scene length are merged.
package scenes

import (
	"context"
	"fmt"
	"math"

	"github.com/bartoval/audio_video_editor/server/internal/media"
)

// Scene is the start of a scene after a cut.
type Scene struct {
	Time  float64 `json:"time"`  // seconds
	Type  string  `json:"type"`  // always "cut"
	Score float64 `json:"score"` // the threshold, as the ML worker reported it
}

// Result lists the cuts of a video.
type Result struct {
	Scenes   []Scene `json:"scenes"`
	FPS      float64 `json:"fps"`
	Duration float64 `json:"duration"`
}

const analysisWidth = 256

// resizer shrinks frames to about analysisWidth pixels the way PySceneDetect
// does, with cv2.resize(INTER_LINEAR): each output pixel blends only the 2x2
// nearest source pixels, in 11-bit fixed point, so fine detail is kept rather
// than averaged away. That detail weighs on the scores, hence the exact copy.
//
// The frames it receives hold only those source pixels: for output column x,
// source columns xs[2x] and xs[2x+1], and likewise for rows.
type resizer struct {
	dw, dh int
	xs, ys []int    // source columns and rows to sample, two per output pixel
	xa, ya [][2]int // weights of each pair, summing to 2048
	dst    []byte
}

const coefBits = 11

func newResizer(sw, sh int) *resizer {
	dw, dh := sw, sh
	if sw > analysisWidth { // OpenCV halves exactly with INTER_AREA: same result
		factor := float64(sw) / analysisWidth
		dw = max(1, int(math.RoundToEven(float64(sw)/factor)))
		dh = max(1, int(math.RoundToEven(float64(sh)/factor)))
	}
	r := &resizer{dw: dw, dh: dh, dst: make([]byte, dw*dh*3)}
	r.xs, r.xa = linearTaps(sw, dw)
	r.ys, r.ya = linearTaps(sh, dh)
	return r
}

// linearTaps returns, for each output position, the two source positions it
// blends and their fixed-point weights.
func linearTaps(src, dst int) ([]int, [][2]int) {
	scale := float64(src) / float64(dst)
	pos, weights := make([]int, 0, 2*dst), make([][2]int, dst)
	for d := range dst {
		f := float32((float64(d)+0.5)*scale - 0.5)
		s := int(math.Floor(float64(f)))
		f -= float32(s)
		if s < 0 {
			s, f = 0, 0
		}
		if s >= src-1 {
			s, f = src-1, 0
		}
		pos = append(pos, s, min(s+1, src-1))
		weights[d] = [2]int{
			int(math.RoundToEven(float64((1 - f) * (1 << coefBits)))),
			int(math.RoundToEven(float64(f * (1 << coefBits)))),
		}
	}
	return pos, weights
}

// resize blends the sampled pairs; samples is len(xs) x len(ys) RGB24.
func (r *resizer) resize(samples []byte) []byte {
	stride := len(r.xs) * 3
	for y := range r.dh {
		row0, row1 := 2*y*stride, (2*y+1)*stride
		b0, b1 := r.ya[y][0], r.ya[y][1]
		for x := range r.dw {
			a0, a1 := r.xa[x][0], r.xa[x][1]
			for c := range 3 {
				i := 2*x*3 + c
				h0 := int(samples[row0+i])*a0 + int(samples[row0+i+3])*a1
				h1 := int(samples[row1+i])*a0 + int(samples[row1+i+3])*a1
				r.dst[(y*r.dw+x)*3+c] = byte((h0*b0 + h1*b1 + 1<<(2*coefBits-1)) >> (2 * coefBits))
			}
		}
	}
	return r.dst
}

// Detect decodes the video and returns its cuts. threshold is on the 0-255
// scale of the pixel values (27 by default); minSceneLen is in seconds.
func Detect(ctx context.Context, video string, threshold, minSceneLen float64) (Result, error) {
	info, err := media.ProbeVideo(ctx, video)
	if err != nil {
		return Result{}, err
	}
	if info.FPS <= 0 {
		return Result{}, fmt.Errorf("unknown frame rate of %s", video)
	}
	shrink := newResizer(info.Width, info.Height)
	d := NewDetector(threshold, int(minSceneLen*info.FPS))
	res := Result{Scenes: []Scene{}, FPS: info.FPS, Duration: info.Duration}
	err = media.RGBSamples(ctx, video, shrink.xs, shrink.ys, func(samples []byte) {
		if d.Add(shrink.resize(samples)) {
			res.Scenes = append(res.Scenes, Scene{
				Time: math.Round(float64(d.Cut())/info.FPS*1000) / 1000, Type: "cut", Score: threshold,
			})
		}
	})
	return res, err
}

// Detector finds cuts in a sequence of RGB24 frames of the same size.
type Detector struct {
	threshold float64
	minLen    int // frames

	frame      int
	prev, cur  []byte // packed HSV of the previous and current frame
	cut        int    // frame of the last cut returned by Add
	lastAbove  int
	mergeOn    bool // merging is allowed once a cut was emitted
	merging    bool
	mergeStart int
}

// NewDetector returns a detector; minLen is the minimum scene length in frames.
func NewDetector(threshold float64, minLen int) *Detector {
	return &Detector{threshold: threshold, minLen: minLen}
}

// Cut is the frame of the cut reported by the last Add that returned true.
// It can be earlier than the frame just added, when cuts were merged.
func (d *Detector) Cut() int { return d.cut }

// Add processes the next frame and reports whether a cut was found.
func (d *Detector) Add(rgb []byte) bool {
	n := d.frame
	d.frame++
	if cap(d.cur) < len(rgb) {
		d.cur = make([]byte, len(rgb))
	}
	d.cur = d.cur[:len(rgb)]
	toHSV(d.cur, rgb)
	if d.prev == nil {
		d.prev = make([]byte, len(rgb))
		copy(d.prev, d.cur)
		return false // the first frame only sets the reference
	}
	var dh, ds, dv int
	for i := 0; i < len(rgb); i += 3 {
		dh += absDiff(d.cur[i], d.prev[i])
		ds += absDiff(d.cur[i+1], d.prev[i+1])
		dv += absDiff(d.cur[i+2], d.prev[i+2])
	}
	d.prev, d.cur = d.cur, d.prev
	pixels := float64(len(rgb) / 3)
	score := (float64(dh)/pixels + float64(ds)/pixels + float64(dv)/pixels) / 3
	return d.filter(n, score >= d.threshold)
}

// filter is FlashFilter in MERGE mode: a cut closer than minLen to the
// previous frame above the threshold starts merging, which ends with a cut
// at the last frame above the threshold once the scene is long enough.
func (d *Detector) filter(n int, above bool) bool {
	if d.minLen <= 0 {
		d.cut = n
		return above
	}
	lengthMet := n-d.lastAbove >= d.minLen
	if above {
		d.lastAbove = n
	}
	if d.merging {
		if lengthMet && !above && d.lastAbove-d.mergeStart >= d.minLen {
			d.merging = false
			d.cut = d.lastAbove
			return true
		}
		return false
	}
	if !above {
		return false
	}
	if lengthMet {
		d.mergeOn = true
		d.cut = n
		return true
	}
	if d.mergeOn {
		d.merging, d.mergeStart = true, n
	}
	return false
}

func absDiff(a, b byte) int {
	if a > b {
		return int(a - b)
	}
	return int(b - a)
}

// OpenCV's 8-bit RGB to HSV tables: hue in 0-179, saturation and value in 0-255.
const hsvShift = 12

var sdiv, hdiv [256]int

func init() {
	for i := 1; i < 256; i++ {
		sdiv[i] = int(math.RoundToEven(float64(255<<hsvShift) / float64(i)))
		hdiv[i] = int(math.RoundToEven(float64(180<<hsvShift) / (6 * float64(i))))
	}
}

// toHSV converts packed RGB24 to packed HSV exactly as cv2.cvtColor(BGR2HSV).
func toHSV(dst, rgb []byte) {
	const half = 1 << (hsvShift - 1)
	for i := 0; i < len(rgb); i += 3 {
		r, g, b := int(rgb[i]), int(rgb[i+1]), int(rgb[i+2])
		v := max(r, g, b)
		diff := v - min(r, g, b)
		var h int
		switch {
		case v == r:
			h = g - b
		case v == g:
			h = b - r + 2*diff
		default:
			h = r - g + 4*diff
		}
		h = (h*hdiv[diff] + half) >> hsvShift
		if h < 0 {
			h += 180
		}
		dst[i], dst[i+1], dst[i+2] = byte(h), byte((diff*sdiv[v]+half)>>hsvShift), byte(v)
	}
}

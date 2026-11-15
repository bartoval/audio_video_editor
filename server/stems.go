package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/bartoval/steammeros/stems"

	"github.com/bartoval/audio_video_editor/server/internal/separation"
)

// Prepare once at startup; the worker can then reopen the model without network
// access whenever a job arrives, releasing its GPU memory while idle.
func stemsModel(ctx context.Context) (separation.OpenEngine, error) {
	opts, err := stemsOptions(ctx)
	if err != nil || opts == nil {
		return nil, err
	}
	open := func() (separation.Engine, error) {
		engine, err := stems.NewEngine(*opts)
		if err != nil {
			return nil, err
		}
		return engine, nil
	}
	engine, err := open()
	if err != nil {
		return nil, fmt.Errorf("load stems model: %w", err)
	}
	engine.Close()
	slog.Info("stem separation on", "model", opts.ModelPath, "cuda", opts.CUDA)
	return open, nil
}

func stemsOptions(ctx context.Context) (*stems.Options, error) {
	mode := env("STEMS_DEVICE", "auto")
	switch mode {
	case "off":
		slog.Info("stem separation off")
		return nil, nil
	case "auto", "cpu", "cuda", "cuda-fast":
	default:
		return nil, fmt.Errorf("STEMS_DEVICE must be auto, cpu, cuda, cuda-fast or off")
	}
	device := 0
	if value := os.Getenv("STEMS_CUDA_DEVICE"); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 0 {
			return nil, fmt.Errorf("STEMS_CUDA_DEVICE must be a non-negative GPU index")
		}
		device = n
		if mode == "auto" {
			mode = "cuda" // Preserve explicitly configured GPU selection.
		}
	}
	if mode == "auto" {
		mode = "cpu"
		if runtime.GOOS == "linux" && runtime.GOARCH == "amd64" {
			probeCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
			out, err := exec.CommandContext(probeCtx, "nvidia-smi", "--query-gpu=index", "--format=csv,noheader").Output()
			cancel()
			if err == nil && strings.TrimSpace(string(out)) != "" {
				mode = "cuda"
			}
		}
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	opts := stems.Options{
		ModelPath: os.Getenv("STEMS_MODEL"), ORTLibrary: os.Getenv("STEMS_ORT_LIBRARY"),
		CUDAOpsLibrary: os.Getenv("STEMS_CUDA_OPS"), CUDA: mode != "cpu", CUDADevice: device,
	}
	if opts.ModelPath != "" {
		if mode == "cuda-fast" {
			return nil, fmt.Errorf("STEMS_DEVICE=cuda-fast selects its own model; unset STEMS_MODEL")
		}
		return &opts, nil
	}
	offline, err := strconv.ParseBool(env("STEMS_OFFLINE", "false"))
	if err != nil {
		return nil, fmt.Errorf("STEMS_OFFLINE: %w", err)
	}
	slog.Info("preparing stem separation", "device", mode, "offline", offline,
		"note", "model and runtimes download on first start; later starts reuse the cache")
	opts, err = stems.Prepare(ctx, stems.PrepareOptions{
		CUDA: opts.CUDA, Fast: mode == "cuda-fast", CacheDir: os.Getenv("STEMS_CACHE_DIR"), Offline: offline,
	})
	if err != nil {
		return nil, fmt.Errorf("prepare stems: %w", err)
	}
	opts.CUDADevice = device
	return &opts, nil
}

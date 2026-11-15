package main

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestStemsConfiguration(t *testing.T) {
	for _, tc := range []struct {
		name, mode, gpu string
		cuda            bool
		device          int
	}{
		{"auto without NVIDIA", "auto", "", false, 0},
		{"CPU", "cpu", "", false, 0},
		{"explicit GPU", "cuda", "2", true, 2},
		{"legacy GPU selection", "auto", "1", true, 1},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("PATH", t.TempDir()) // No NVIDIA executable; never probe the host GPU.
			t.Setenv("STEMS_DEVICE", tc.mode)
			t.Setenv("STEMS_CUDA_DEVICE", tc.gpu)
			t.Setenv("STEMS_MODEL", "/custom/model.onnx") // Custom paths never download assets.
			t.Setenv("STEMS_ORT_LIBRARY", "/custom/ort.so")
			t.Setenv("STEMS_CUDA_OPS", "")
			opts, err := stemsOptions(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			if opts == nil || opts.CUDA != tc.cuda || opts.CUDADevice != tc.device ||
				opts.ModelPath != "/custom/model.onnx" || opts.ORTLibrary != "/custom/ort.so" {
				t.Fatalf("unexpected options: %+v", opts)
			}
		})
	}
}

func TestStemsDisabledAndInvalidConfiguration(t *testing.T) {
	t.Setenv("STEMS_DEVICE", "off")
	open, err := stemsModel(t.Context())
	if err != nil || open != nil {
		t.Fatalf("disabled stems: engine configured=%t, error=%v", open != nil, err)
	}
	for _, tc := range []struct{ mode, gpu, want string }{
		{"invalid", "", "STEMS_DEVICE"},
		{"cuda", "-1", "STEMS_CUDA_DEVICE"},
		{"cuda", "invalid", "STEMS_CUDA_DEVICE"},
		{"cuda-fast", "", "unset STEMS_MODEL"},
	} {
		t.Setenv("STEMS_DEVICE", tc.mode)
		t.Setenv("STEMS_CUDA_DEVICE", tc.gpu)
		t.Setenv("STEMS_MODEL", "/custom/model.onnx")
		if _, err := stemsOptions(t.Context()); err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatalf("mode %q GPU %q: %v", tc.mode, tc.gpu, err)
		}
	}
}

func TestStemsPreparationOfflineAndCancelled(t *testing.T) {
	t.Setenv("STEMS_DEVICE", "cpu")
	t.Setenv("STEMS_CUDA_DEVICE", "")
	t.Setenv("STEMS_MODEL", "")
	t.Setenv("STEMS_CACHE_DIR", t.TempDir())
	t.Setenv("STEMS_OFFLINE", "true")
	if _, err := stemsOptions(t.Context()); err == nil || !strings.Contains(err.Error(), "assets are not cached") {
		t.Fatalf("empty offline cache: %v", err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if _, err := stemsOptions(ctx); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled startup: %v", err)
	}
}

#!/bin/bash
set -e

echo "=== Compiling Audio Mastering C++ DSP to WebAssembly ==="

if ! command -v emcc &> /dev/null; then
    echo "Notice: emcc (Emscripten) is not found in PATH."
    echo "You can install Emscripten SDK via: https://emscripten.org/docs/getting_started/downloads.html"
    echo "Alternatively, the application includes the automated Wabt compilation pipeline in scripts/compile_wasm.js."
    exit 0
fi

mkdir -p ../public

emcc -O3 -std=c++17 -Iinclude \
    src/mastering_engine.cpp \
    src/emscripten_bindings.cpp \
    -s WASM=1 \
    -s SIDE_MODULE=0 \
    -s EXPORTED_FUNCTIONS='["_malloc","_free","_dsp_init","_dsp_reset","_dsp_set_bypass","_dsp_set_input_gain","_dsp_set_output_gain","_dsp_set_eq_band","_dsp_set_eq_match_amount","_dsp_set_eq_all_bands","_dsp_set_compressor","_dsp_set_limiter","_dsp_get_input_buffer_l","_dsp_get_input_buffer_r","_dsp_get_output_buffer_l","_dsp_get_output_buffer_r","_dsp_process","_dsp_get_comp_reduction","_dsp_get_limiter_reduction","_dsp_get_momentary_lufs","_dsp_get_shortterm_lufs","_dsp_get_integrated_lufs"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s INITIAL_MEMORY=16777216 \
    -s ENVIRONMENT='web,worker' \
    --no-entry \
    -o ../public/dsp_engine.wasm

echo "Successfully built ../public/dsp_engine.wasm"

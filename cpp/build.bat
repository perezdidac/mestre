@echo off
echo === Compiling Audio Mastering C++ DSP to WebAssembly ===

where emcc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Notice: emcc (Emscripten) is not found in PATH.
    echo To compile using Emscripten, activate emsdk first: emsdk_env.bat
    echo The project also includes scripts/compile_wasm.js which compiles the DSP engine using wabt.
    exit /b 0
)

if not exist "..\public" mkdir "..\public"

emcc -O3 -std=c++17 -Iinclude ^
    src\mastering_engine.cpp ^
    src\emscripten_bindings.cpp ^
    -s WASM=1 ^
    -s SIDE_MODULE=0 ^
    -s EXPORTED_FUNCTIONS="['_malloc','_free','_dsp_init','_dsp_reset','_dsp_set_bypass','_dsp_set_input_gain','_dsp_set_output_gain','_dsp_set_eq_band','_dsp_set_eq_match_amount','_dsp_set_eq_all_bands','_dsp_set_compressor','_dsp_set_limiter','_dsp_get_input_buffer_l','_dsp_get_input_buffer_r','_dsp_get_output_buffer_l','_dsp_get_output_buffer_r','_dsp_process','_dsp_get_comp_reduction','_dsp_get_limiter_reduction','_dsp_get_momentary_lufs','_dsp_get_shortterm_lufs','_dsp_get_integrated_lufs']" ^
    -s EXPORTED_RUNTIME_METHODS="['ccall','cwrap','getValue','setValue']" ^
    -s ALLOW_MEMORY_GROWTH=1 ^
    -s INITIAL_MEMORY=16777216 ^
    -s ENVIRONMENT="web,worker" ^
    --no-entry ^
    -o ..\public\dsp_engine.wasm

echo Successfully built ..\public\dsp_engine.wasm

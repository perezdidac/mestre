cmake_minimum_required(VERSION 3.15)
project(AudioMasteringDSP VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include_directories(include)

set(DSP_SOURCES
    src/mastering_engine.cpp
    src/emscripten_bindings.cpp
)

if (EMSCRIPTEN)
    add_executable(dsp_engine ${DSP_SOURCES})
    set_target_properties(dsp_engine PROPERTIES
        OUTPUT_NAME "dsp_engine"
        SUFFIX ".wasm"
        LINK_FLAGS "\
            -O3 \
            -s WASM=1 \
            -s SIDE_MODULE=0 \
            -s EXPORTED_FUNCTIONS='[\"_malloc\",\"_free\",\"_dsp_init\",\"_dsp_reset\",\"_dsp_set_bypass\",\"_dsp_set_input_gain\",\"_dsp_set_output_gain\",\"_dsp_set_eq_band\",\"_dsp_set_eq_match_amount\",\"_dsp_set_eq_all_bands\",\"_dsp_set_compressor\",\"_dsp_set_limiter\",\"_dsp_get_input_buffer_l\",\"_dsp_get_input_buffer_r\",\"_dsp_get_output_buffer_l\",\"_dsp_get_output_buffer_r\",\"_dsp_process\",\"_dsp_get_comp_reduction\",\"_dsp_get_limiter_reduction\",\"_dsp_get_momentary_lufs\",\"_dsp_get_shortterm_lufs\",\"_dsp_get_integrated_lufs\"]' \
            -s EXPORTED_RUNTIME_METHODS='[\"ccall\",\"cwrap\",\"getValue\",\"setValue\"]' \
            -s ALLOW_MEMORY_GROWTH=1 \
            -s INITIAL_MEMORY=16777216 \
            -s ENVIRONMENT='web,worker' \
            --no-entry"
    )
else()
    add_library(dsp_engine STATIC ${DSP_SOURCES})
endif()

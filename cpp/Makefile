# Makefile for building Audio Mastering DSP WebAssembly module with Emscripten

EMCC = emcc
CXXFLAGS = -O3 -std=c++17 -Iinclude -Wall -Wextra
OUTPUT_DIR = ../public
TARGET_WASM = $(OUTPUT_DIR)/dsp_engine.wasm

SOURCES = src/mastering_engine.cpp src/emscripten_bindings.cpp

EXPORTED_FUNCS = '["_malloc","_free","_dsp_init","_dsp_reset","_dsp_set_bypass","_dsp_set_input_gain","_dsp_set_output_gain","_dsp_set_eq_band","_dsp_set_eq_match_amount","_dsp_set_eq_all_bands","_dsp_set_compressor","_dsp_set_limiter","_dsp_get_input_buffer_l","_dsp_get_input_buffer_r","_dsp_get_output_buffer_l","_dsp_get_output_buffer_r","_dsp_process","_dsp_get_comp_reduction","_dsp_get_limiter_reduction","_dsp_get_momentary_lufs","_dsp_get_shortterm_lufs","_dsp_get_integrated_lufs"]'

LDFLAGS = -O3 -s WASM=1 -s SIDE_MODULE=0 \
          -s EXPORTED_FUNCTIONS=$(EXPORTED_FUNCS) \
          -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","getValue","setValue"]' \
          -s ALLOW_MEMORY_GROWTH=1 \
          -s INITIAL_MEMORY=16777216 \
          -s ENVIRONMENT='web,worker' \
          --no-entry

all: $(TARGET_WASM)

$(TARGET_WASM): $(SOURCES)
	@mkdir -p $(OUTPUT_DIR)
	$(EMCC) $(CXXFLAGS) $(SOURCES) $(LDFLAGS) -o $(TARGET_WASM)
	@echo "Wasm module built successfully at $(TARGET_WASM)"

clean:
	rm -f $(TARGET_WASM)

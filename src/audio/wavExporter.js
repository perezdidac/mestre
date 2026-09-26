/**
 * Professional WAV Audio File Exporter
 * Encodes audio buffers into 16-bit PCM, 24-bit PCM, or 32-bit Float WAV files
 * with optional TPDF (Triangular Probability Density Function) dither.
 */

export class WavExporter {
    /**
     * Export an AudioBuffer and trigger browser download
     * @param {AudioBuffer} audioBuffer 
     * @param {string} filename 
     * @param {number} bitDepth 16, 24, or 32
     * @param {boolean} enableDither 
     */
    static downloadWav(audioBuffer, filename = 'Mastered_Track.wav', bitDepth = 24, enableDither = true) {
        const wavBytes = this.encodeWav(audioBuffer, bitDepth, enableDither);
        const blob = new Blob([wavBytes], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();

        setTimeout(() => {
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
        }, 1000);
    }

    /**
     * Encode AudioBuffer into Uint8Array representing a valid RIFF/WAVE file
     */
    static encodeWav(audioBuffer, bitDepth = 24, enableDither = true) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const numSamples = audioBuffer.length;
        const bytesPerSample = bitDepth / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataLength = numSamples * blockAlign;
        const bufferLength = 44 + dataLength;

        const arrayBuffer = new ArrayBuffer(bufferLength);
        const view = new DataView(arrayBuffer);

        // 1. RIFF Header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataLength, true); // File size - 8
        this.writeString(view, 8, 'WAVE');

        // 2. "fmt " Sub-chunk
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
        
        // Audio format: 1 = PCM, 3 = IEEE Float
        const audioFormat = (bitDepth === 32) ? 3 : 1;
        view.setUint16(20, audioFormat, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitDepth, true);

        // 3. "data" Sub-chunk
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);

        // 4. Interleave and encode PCM samples
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(audioBuffer.getChannelData(ch));
        }

        let offset = 44;

        if (bitDepth === 16) {
            for (let i = 0; i < numSamples; i++) {
                for (let ch = 0; ch < numChannels; ch++) {
                    let sample = channels[ch][i];
                    if (enableDither) {
                        // TPDF Dither (+/- 1 LSB triangular)
                        const dither = (Math.random() - Math.random()) / 32768.0;
                        sample += dither;
                    }
                    const clamped = Math.max(-1.0, Math.min(1.0, sample));
                    const intVal = clamped < 0 ? clamped * 32768 : clamped * 32767;
                    view.setInt16(offset, Math.floor(intVal), true);
                    offset += 2;
                }
            }
        } else if (bitDepth === 24) {
            for (let i = 0; i < numSamples; i++) {
                for (let ch = 0; ch < numChannels; ch++) {
                    let sample = channels[ch][i];
                    if (enableDither) {
                        const dither = (Math.random() - Math.random()) / 8388608.0;
                        sample += dither;
                    }
                    const clamped = Math.max(-1.0, Math.min(1.0, sample));
                    const intVal = clamped < 0 ? clamped * 8388608 : clamped * 8388607;
                    const val = Math.floor(intVal);
                    // 3 bytes little-endian
                    view.setUint8(offset, val & 0xff);
                    view.setUint8(offset + 1, (val >> 8) & 0xff);
                    view.setUint8(offset + 2, (val >> 16) & 0xff);
                    offset += 3;
                }
            }
        } else if (bitDepth === 32) {
            for (let i = 0; i < numSamples; i++) {
                for (let ch = 0; ch < numChannels; ch++) {
                    const sample = channels[ch][i];
                    view.setFloat32(offset, sample, true);
                    offset += 4;
                }
            }
        }

        return new Uint8Array(arrayBuffer);
    }

    static writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }
}

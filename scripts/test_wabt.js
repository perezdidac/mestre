const fs = require('fs');

async function test() {
    const wabtModule = require('wabt');
    const wabt = await wabtModule();
    const watSource = `
    (module
        (memory (export "memory") 1)
        (func (export "add") (param $a f32) (param $b f32) (result f32)
            local.get $a
            local.get $b
            f32.add
        )
    )
    `;
    const parsed = wabt.parseWat('test.wat', watSource);
    const { buffer } = parsed.toBinary({});
    console.log('Successfully parsed WAT! Binary length:', buffer.length);
}

test().catch(console.error);

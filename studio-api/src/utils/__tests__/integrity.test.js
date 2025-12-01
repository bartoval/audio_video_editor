const { computeFileHash } = require('../integrity');
const fs = require('fs');
const path = require('path');

describe('computeFileHash', () => {
  it('computes same hash for identical content', async () => {
    const tmpDir = fs.mkdtempSync(path.join(__dirname, 'tmp-hash-'));
    const file1 = path.join(tmpDir, 'a.txt');
    const file2 = path.join(tmpDir, 'b.txt');
    fs.writeFileSync(file1, 'hello');
    fs.writeFileSync(file2, 'hello');

    const h1 = await computeFileHash(file1);
    const h2 = await computeFileHash(file2);
    expect(h1).toBe(h2);
  });
});

/**
 * @file src/ の GAS のファイルを、手元の Node.js で読み込むための補助。
 * GAS のファイルは、全ファイルが 1 つのグローバル空間を共有する前提で書かれていて、export を持たない。
 * そのため、ファイルをつなげて 1 つの関数として実行し、テストで使う名前だけを取り出す。
 * テストは、リポジトリのルートで node --test tests/*.test.js を実行して動かす。tests/ は rootDir（src/）の外のため、push されない。
 */

const fs = require('node:fs');
const path = require('node:path');

/**
 * src/ のファイルを読み込み、指定した名前の関数・定数を返す。
 * GAS のサービス（SpreadsheetApp など）は用意しない。計算だけの関数を確かめるための補助のため。
 * @param {string[]} files 読み込むファイル名（src/ からの相対パス）
 * @param {string[]} names 取り出す関数・定数の名前
 * @return {Object} 名前から関数・定数を引けるオブジェクト
 */
function loadGas(files, names) {
  const source = files
    .map((file) => fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8'))
    .join('\n');
  return new Function(`${source}\nreturn { ${names.join(', ')} };`)();
}

module.exports = { loadGas };

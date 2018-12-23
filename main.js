interpreter = require('./core')

var batch = false;

var language = "ja";
//var mode_flag = "none";
var mode_flag = "keyboard";

if (batch) { //バッチテスト
    var text = [];
    var textid = 0;
    var testin = require('./csvjword.js');
    //var testin = require('./testin/test_in_sample-jp.js');
    //var testin = require('./sample_greetings.js');
    //var testin = require('./sample.js');
    //var testin = require('./make_db/jmeisho.js');
    //var testin = require('./make_db/joutplace.js');
    //var testin = require('./make_db/jhotel.js');
    //var testin = require('./make_db/jplace.js');
    //var testin = require('./make_db/jstation.js');
    //var testin = require('./sample_kadai.js');
    //var testin = require('./ss.js');
    var example = testin.make();

    for (var i = 0; i < example.length; i++) {
        text[i] = example[i];
    }
    var readline = require('readline'),
        rl = readline.createInterface(process.stdin, process.stdout),
        prefix = '\n> ';

    rl.on('line', function (line0) {
        if (textid < text.length) { // デモ中
            var line = text[textid]; textid++;
        } else if (isNaN(line0.charCodeAt(0))) { // Enterキー
            noEmpty = false;
        } else { // リアル入力
            line = line0;
        }
        try {
            if (noEmpty) {
                //console.log(line);
                interpreter(language, mode_flag, line);
            }

        } catch (e) {
            console.log("問題が起きました。", e);
        } finally {
            noEmpty = true;
            rl.prompt();
        }

    }).on('close', function () {
        console.log('batch test end');
        process.exit(0); // needed for the process ending
    });

    rl.setPrompt(prefix, prefix.length);
    rl.prompt();
}
else { //インタラクティブテスト

    // テストデータ入力および結果の出力
    var readline = require('readline'),
        rl = readline.createInterface(process.stdin, process.stdout),
        prefix = '\n> ';
    var noEmpty = true;
    rl.on('line', function (line0) {
        if (isNaN(line0.charCodeAt(0))) { // Enterキー
            noEmpty = false;
        } else { // リアル入力
            //line = line0;
        }
        try {
            if (noEmpty) {
                interpreter(language, mode_flag, line0);
            }
        } catch (e) {
            console.log("問題が起きました。", e);
        } finally {
            noEmpty = true;
            rl.prompt();
        }
    }).on('close', function () {
        console.log('exit');
        process.exit(0);
    });
    console.log('会話テスト');
    rl.setPrompt(prefix, prefix.length);
    rl.prompt();
}

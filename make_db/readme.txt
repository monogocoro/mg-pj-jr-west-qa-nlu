辞書管理

基本発想。日本語／英語への対応を1つにしたい。

例。
(日)保津川下り -> [みらい/core] -> hozu_river_rifting
(英)I want to go to HOZU RIVER RAFTING. ->[core] I want to go to hozu_river_rafting.
    I want to go to HOZUGAWA KUDARI.             I want to to to hozugawa_kudari.

推論ルールsrules.js 内
  hozu_river_riftingあるいは hozugawa_kudariでマッチしたルールが起動される。

後処理
  hozu_river_riftingあるいはhozugawa_kudariを保津川下りに変換する。

名詞辞書
英語は、英文が入力された時、および日本文を「みらい」で翻訳した両方の場合に対応。

基本辞書 以下の複数の辞書をマージし、e2j_dicを作成
[英語名] [和名] [ひらがな]
	 ここでkyoto-towerとかは、kyototowerも登録する。
	 キーボードからはkyototowerを仮定。
	 また、ひらがな音は1種類のみ。たとえば、もう1つ用意することは辞書列をふやすことで対応。

日本語入力後、
(1) j2e_dic 「みらい」で誤変換する可能性のあるものは、本来の単語名の英語名に変換。たとえば「みどりのまどぐち」はMIDORINOMADOGUCHIに
(2) 「みらい」出力後、enjuniに入力する前に、enjuでの文法カテゴリに狂いが生じないよう、一部の単語を大文字化する。ただｓ，どこまでやるか、そこはテストが必要。
(3) scodeに対し、srules.jsでルールを適用。その最は、e2j_dicから作られた一列辞書（英語名のみのリスト）をカテゴリ別に利用。
(4)最後、jcodeを生成する際、英語名称を和名に変換。

英語入力後
(2)から(4)まで

[ファイル名: e2j_meisho_dic]
hozugawa-kudari,保津川下り
hozu-gawa-kudari,保津川下り
hozu-river-rafting,保津川下り
kyoto-international-manga-museum,京都国際マンガミュージアム
international-manga-museum,京都国際マンガミュージアム
manga-museum,京都国際マンガミュージアム

駅 e2j_station_dic.csv
名所 e2j_meisho_dic.csv
ホテル e2j_hotel_dic.csv
列車 e2j_train_dic.csv
路線 e2j_line_dic.csv
駅構内 e2j_facility_dic.csv
ゲート e2j_gate_dic.csv
その他施設 e2j_place_dic.csv

＃inoutCSV.js ファイル

上記すべてのファイルを読み込む。



(0) 日本語だけ一列のリスト 英語変換の確認のため。
　　　可能性：誤変換、ハイフンが入る、そのまま。
(1) 英ー日一覧辞書
(2) 英(小)-英(大)辞書  enju内で使われ、小文字になる
(3) 各辞書ごとに英字部分を一列に排出
     e2j_station_dic.csv -> e_station_list.csv

--- 課題
今回


京都駅から大阪まで
 => {"queryTDB":{"from":"kyoto#京都","to":"kyoto#京都"}}になってしまう。
大阪から京都まで

弁当　/ 駅弁
飲み物が something to drink
売店
ランチ
喉がかわいた
お腹が空いた
ファミリーマート
駅弁買いたい
駅弁を買いたい
駅弁
お弁当やさん
お弁当はどこ
お弁当買いたい
キオスク
売店
コーヒー飲みたい
ジュースが飲みたい
ランチが食べたい
タバコがすえる場所は？
喉がかわいたよ
おなかがすいたよ
ご飯が食べたい
おすすめ観光スポットは？
ヨドバシどこ？
たばこが吸いたい
入場券を買いたい
遅延証明書
遅延証明書がほしい
両替したい
両替できるところ
駅員さんと話したい

ファミリーマート
セブンイレブン
セブンイレブンはどこですか
ヨドバシはどこ
高速バスに乗りたい
タクシーに乗りたい


---


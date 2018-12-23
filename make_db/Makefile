csv2js: csv2js.c
	cc -o csv2js csv2js.c
j2e: j2e_dic
	./csv2js j2e_dic j2e_dic_header
	node j2e_dicdb.js
e2j: e2j_dic
	./csv2js e2j_dic e2j_dic_header
	node e2j_dicdb.js
list_bank: list_bank_dic
	./csv2js list_bank_dic list_header
	node list_bank_dicdb.js
list_event: list_event_dic
	./csv2js list_event_dic list_header
	node list_event_dicdb.js
list_facility: list_facility_dic
	./csv2js list_facility_dic list_header
	node list_facility_dicdb.js
list_gate: list_gate_dic
	./csv2js list_gate_dic list_header
	node list_gate_dicdb.js
list_hotel: list_hotel_dic
	./csv2js list_hotel_dic list_header
	node list_hotel_dicdb.js
list_line: list_line_dic
	./csv2js list_line_dic list_header
	node list_line_dicdb.js
list_meisho: list_meisho_dic
	./csv2js list_meisho_dic list_header
	node list_meisho_dicdb.js
list_outplace: list_outplace_dic
	./csv2js list_outplace_dic list_header
	node list_outplace_dicdb.js
list_place: list_place_dic
	./csv2js list_place_dic list_header
	node list_place_dicdb.js
list_station: list_station_dic
	./csv2js list_station_dic list_header
	node list_station_dicdb.js
list_train: list_train_dic
	./csv2js list_train_dic list_header
	node list_train_dicdb.js
list_transport: list_transport_dic
	./csv2js list_transport_dic list_header
	node list_transport_dicdb.js
list_ticket: list_ticket_dic
	./csv2js list_ticket_dic list_header
	node list_ticket_dicdb.js
voice_correction: voice_correction_dic
	./csv2js voice_correction_dic voice_correction_dic_header
	node voice_correction_dicdb.js
mirai_correction: mirai_correction_dic
	./csv2js mirai_correction_dic mirai_correction_dic_header
	node mirai_correction_dicdb.js
csv:
	node inoutCSV.js
	mv e2j_dic.org e2j_dic
all: j2e e2j list_ticket list_transport list_train list_station list_outplace list_meisho list_line list_hotel list_gate list_facility list_event list_bank  voice_correction mirai_correction list_place

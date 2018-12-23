'use strict'

const Realm = require("realm")

const list_station_dicdb = {
    name: "list_station_dicdb",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
        },
	word: {
	    type: "string",
	}
    }
}
    
function createDB(db, schema_name, list){
    db.write(() => {
	list.forEach((val, key) => {
	    db.create(
		schema_name,
		val
	    );
        });
    });
}    

const db = new Realm({path: "../db/list_station_dic.db", schema: [list_station_dicdb]});

const dic = require('./list_station_dic.js');
const list_station_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_station_dicdb", list_station_list);

db.close();
process.exit(0);



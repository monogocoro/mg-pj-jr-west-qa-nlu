'use strict'

const Realm = require("realm")

const list_facility_dicdb = {
    name: "list_facility_dicdb",
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

const db = new Realm({path: "../db/list_facility_dic.db", schema: [list_facility_dicdb]});

const dic = require('./list_facility_dic.js');
const list_facility_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "list_facility_dicdb", list_facility_list);

db.close();
process.exit(0);



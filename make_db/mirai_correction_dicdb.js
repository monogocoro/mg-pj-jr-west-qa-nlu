'use strict'

const Realm = require("realm")

const mirai_correction_dicdb = {
    name: "mirai_correction_dicdb",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
        },
	wrong: {
	    type: "string",
	},
	teisei: {
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

const db = new Realm({path: "../db/mirai_correction_dic.db", schema: [mirai_correction_dicdb]});

const dic = require('./mirai_correction_dic.js');
const e2j_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "mirai_correction_dicdb", e2j_list);

db.close();
process.exit(0);



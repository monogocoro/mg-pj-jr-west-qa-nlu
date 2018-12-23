'use strict'

const Realm = require("realm")

const voice_correction_dicdb = {
    name: "voice_correction_dicdb",
    primaryKey: "id",
    properties: {
        id: {
            type: "string",
        },
	henkan: {
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

const db = new Realm({path: "../db/voice_correction_dic.db", schema: [voice_correction_dicdb]});

const dic = require('./voice_correction_dic.js');
const e2j_list = dic.make();

db.write(() => db.deleteAll())
createDB(db, "voice_correction_dicdb", e2j_list);

db.close();
process.exit(0);



const Datastore = require('@seald-io/nedb');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, process.env.NODE_ENV === 'test' ? '../../data/test-db' : '../../data/db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const inMemory = process.env.NODE_ENV === 'test';

const db = {
  users:     new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'users.db'),     autoload: !inMemory }),
  provinces: new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'provinces.db'), autoload: !inMemory }),
  districts: new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'districts.db'), autoload: !inMemory }),
  stations:  new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'stations.db'),  autoload: !inMemory }),
  vehicles:  new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'vehicles.db'),  autoload: !inMemory }),
  drivers:   new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'drivers.db'),   autoload: !inMemory }),
  locations: new Datastore({ inMemoryOnly: inMemory, filename: inMemory ? undefined : path.join(dbDir, 'locations.db'), autoload: !inMemory }),
};

// Create indexes for performance
db.users.ensureIndex({ fieldName: 'username', unique: true });
db.provinces.ensureIndex({ fieldName: 'code', unique: true });
db.districts.ensureIndex({ fieldName: 'code', unique: true });
db.vehicles.ensureIndex({ fieldName: 'registrationNumber', unique: true });
db.vehicles.ensureIndex({ fieldName: 'deviceId', unique: true, sparse: true });
db.drivers.ensureIndex({ fieldName: 'licenseNumber', unique: true });
db.locations.ensureIndex({ fieldName: 'vehicleId' });
db.locations.ensureIndex({ fieldName: 'timestamp' });

// Promisify NeDB operations
const dbAsync = {};
for (const [name, store] of Object.entries(db)) {
  dbAsync[name] = {
    insert:  (doc)              => new Promise((res, rej) => store.insert(doc, (e, d)    => e ? rej(e) : res(d))),
    find:    (query, proj = {}) => new Promise((res, rej) => store.find(query, proj, (e, d) => e ? rej(e) : res(d))),
    findOne: (query, proj = {}) => new Promise((res, rej) => store.findOne(query, proj, (e, d) => e ? rej(e) : res(d))),
    update:  (query, upd, opts) => new Promise((res, rej) => store.update(query, upd, opts || {}, (e, n) => e ? rej(e) : res(n))),
    remove:  (query, opts)      => new Promise((res, rej) => store.remove(query, opts || {}, (e, n) => e ? rej(e) : res(n))),
    count:   (query)            => new Promise((res, rej) => store.count(query, (e, n) => e ? rej(e) : res(n))),
    findWithSort: (query, sort, limit, skip) => new Promise((res, rej) => {
      let cursor = store.find(query).sort(sort || {});
      if (skip)  cursor = cursor.skip(skip);
      if (limit) cursor = cursor.limit(limit);
      cursor.exec((e, d) => e ? rej(e) : res(d));
    }),
  };
}

module.exports = { db, dbAsync };

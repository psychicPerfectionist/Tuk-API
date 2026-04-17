// db/seed.js - Seeds the database with Sri Lanka demo data
// Usage: npm run seed

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { initDatabase, run, batchRun, query, saveDatabase } = require('./database');

const PROVINCES = [
  { name: 'Western Province',       code: 'WP' },
  { name: 'Central Province',       code: 'CP' },
  { name: 'Southern Province',      code: 'SP' },
  { name: 'Northern Province',      code: 'NP' },
  { name: 'Eastern Province',       code: 'EP' },
  { name: 'North Western Province', code: 'NW' },
  { name: 'North Central Province', code: 'NC' },
  { name: 'Uva Province',           code: 'UV' },
  { name: 'Sabaragamuwa Province',  code: 'SB' },
];

const DISTRICTS = [
  { name: 'Colombo',       code: 'CMB', province: 'WP' },
  { name: 'Gampaha',       code: 'GMP', province: 'WP' },
  { name: 'Kalutara',      code: 'KLT', province: 'WP' },
  { name: 'Kandy',         code: 'KND', province: 'CP' },
  { name: 'Matale',        code: 'MTL', province: 'CP' },
  { name: 'Nuwara Eliya',  code: 'NWE', province: 'CP' },
  { name: 'Galle',         code: 'GLL', province: 'SP' },
  { name: 'Matara',        code: 'MAT', province: 'SP' },
  { name: 'Hambantota',    code: 'HBT', province: 'SP' },
  { name: 'Jaffna',        code: 'JFN', province: 'NP' },
  { name: 'Kilinochchi',   code: 'KLN', province: 'NP' },
  { name: 'Mannar',        code: 'MNR', province: 'NP' },
  { name: 'Vavuniya',      code: 'VVN', province: 'NP' },
  { name: 'Mullaitivu',    code: 'MLT', province: 'NP' },
  { name: 'Trincomalee',   code: 'TRC', province: 'EP' },
  { name: 'Batticaloa',    code: 'BTC', province: 'EP' },
  { name: 'Ampara',        code: 'AMP', province: 'EP' },
  { name: 'Kurunegala',    code: 'KRN', province: 'NW' },
  { name: 'Puttalam',      code: 'PTL', province: 'NW' },
  { name: 'Anuradhapura',  code: 'ADP', province: 'NC' },
  { name: 'Polonnaruwa',   code: 'PLN', province: 'NC' },
  { name: 'Badulla',       code: 'BDL', province: 'UV' },
  { name: 'Monaragala',    code: 'MRG', province: 'UV' },
  { name: 'Ratnapura',     code: 'RTP', province: 'SB' },
  { name: 'Kegalle',       code: 'KGL', province: 'SB' },
];

const STATIONS = [
  { name: 'Police Headquarters',         code: 'PHQ', district: 'CMB', phone: '+94112421111' },
  { name: 'Colombo Fort Police Station', code: 'COF', district: 'CMB', phone: '+94112326941' },
  { name: 'Wellawatte Police Station',   code: 'WLW', district: 'CMB', phone: '+94112502911' },
  { name: 'Nugegoda Police Station',     code: 'NGG', district: 'CMB', phone: '+94112853388' },
  { name: 'Dehiwala Police Station',     code: 'DHW', district: 'CMB', phone: '+94112718891' },
  { name: 'Gampaha Police Station',      code: 'GMP', district: 'GMP', phone: '+94332222222' },
  { name: 'Negombo Police Station',      code: 'NGM', district: 'GMP', phone: '+94312223133' },
  { name: 'Ja-Ela Police Station',       code: 'JEL', district: 'GMP', phone: '+94112225544' },
  { name: 'Kalutara Police Station',     code: 'KLT', district: 'KLT', phone: '+94342222411' },
  { name: 'Kandy Police Station',        code: 'KND', district: 'KND', phone: '+94812222099' },
  { name: 'Kandy City Police Station',   code: 'KNC', district: 'KND', phone: '+94812234567' },
  { name: 'Peradeniya Police Station',   code: 'PRD', district: 'KND', phone: '+94812388901' },
  { name: 'Galle Police Station',        code: 'GLL', district: 'GLL', phone: '+94912222099' },
  { name: 'Galle Fort Police Station',   code: 'GLF', district: 'GLL', phone: '+94912222733' },
  { name: 'Hikkaduwa Police Station',    code: 'HKD', district: 'GLL', phone: '+94912275511' },
  { name: 'Jaffna Police Station',       code: 'JFN', district: 'JFN', phone: '+94212222099' },
  { name: 'Jaffna Central Police',       code: 'JFC', district: 'JFN', phone: '+94212222100' },
  { name: 'Trincomalee Police Station',  code: 'TRC', district: 'TRC', phone: '+94262222099' },
  { name: 'Kurunegala Police Station',   code: 'KRN', district: 'KRN', phone: '+94372222099' },
  { name: 'Kurunegala City Station',     code: 'KRC', district: 'KRN', phone: '+94372222100' },
  { name: 'Anuradhapura Police Station', code: 'ADP', district: 'ADP', phone: '+94252222099' },
  { name: 'Badulla Police Station',      code: 'BDL', district: 'BDL', phone: '+94552222099' },
  { name: 'Ratnapura Police Station',    code: 'RTP', district: 'RTP', phone: '+94452222099' },
  { name: 'Ratnapura City Station',      code: 'RTC', district: 'RTP', phone: '+94452222100' },
  { name: 'Matara Police Station',       code: 'MAT', district: 'MAT', phone: '+94412222099' },
];

const DISTRICT_COORDS = {
  CMB:[6.9271,79.8612],GMP:[7.0873,79.9994],KLT:[6.5854,79.9607],
  KND:[7.2906,80.6337],MTL:[7.4675,80.6234],NWE:[6.9497,80.7891],
  GLL:[6.0535,80.2210],MAT:[5.9549,80.5550],HBT:[6.1241,81.1185],
  JFN:[9.6615,80.0255],KLN:[9.3803,80.4037],MNR:[8.9760,79.9044],
  VVN:[8.7514,80.4971],MLT:[9.2671,80.8122],TRC:[8.5874,81.2152],
  BTC:[7.7170,81.6924],AMP:[7.2987,81.6669],KRN:[7.4818,80.3609],
  PTL:[8.0362,79.8283],ADP:[8.3456,80.4069],PLN:[7.9403,81.0002],
  BDL:[6.9934,81.0550],MRG:[6.8728,81.3507],RTP:[6.6828,80.3992],
  KGL:[7.2513,80.3464],
};

const MAKES   = ['Bajaj','TVS','Piaggio','Mahindra'];
const MODELS  = ['RE','King','Ape','Alfa'];
const COLOURS = ['Yellow','Yellow & Black','Green'];
const FIRST   = ['Kamal','Nimal','Sunil','Ranjith','Kasun','Dinesh','Chamara','Ruwan','Manoj','Lahiru','Isuru','Dilan','Gayan','Saman','Upul','Hasith','Eranda','Janaka','Tharaka','Nuwan'];
const LAST    = ['Perera','Silva','Fernando','Dissanayake','Wickramasinghe','Jayasinghe','Bandara','Herath','Senanayake','Gunawardena','Ranasinghe','Jayawardena','Wijesinghe','Pathirana','Rathnayake'];

const rnd    = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
const pick   = arr => arr[rndInt(0, arr.length - 1)];
const pad    = (n, w) => String(n).padStart(w, '0');

async function seed() {
  console.log('\n🌱 Seeding database...\n');
  await initDatabase();

  // Clear existing data
  console.log('   Clearing existing data...');
  run('DELETE FROM location_pings');
  run('DELETE FROM users');
  run('DELETE FROM vehicles');
  run('DELETE FROM drivers');
  run('DELETE FROM stations');
  run('DELETE FROM districts');
  run('DELETE FROM provinces');
  try { run('DELETE FROM sqlite_sequence'); } catch (e) { /* ok */ }
  console.log('   Done.');

  // Provinces
  console.log('   Adding 9 provinces...');
  const provinceMap = {};
  for (const p of PROVINCES) {
    const id = run('INSERT INTO provinces (name, code) VALUES (?, ?)', [p.name, p.code]);
    provinceMap[p.code] = id;
  }

  // Districts
  console.log('   Adding 25 districts...');
  const districtMap = {};
  const districtProvinceMap = {};
  for (const d of DISTRICTS) {
    const id = run('INSERT INTO districts (name, code, province_id) VALUES (?, ?, ?)', [d.name, d.code, provinceMap[d.province]]);
    districtMap[d.code] = id;
    districtProvinceMap[d.code] = d.province;
  }

  // Stations
  console.log('   Adding 25 police stations...');
  const stationIds = [];
  for (const s of STATIONS) {
    const id = run('INSERT INTO stations (name, code, district_id, province_id, phone) VALUES (?, ?, ?, ?, ?)',
      [s.name, s.code, districtMap[s.district], provinceMap[districtProvinceMap[s.district]], s.phone]);
    stationIds.push({ id, districtCode: s.district });
  }

  // Drivers
  console.log('   Adding 220 drivers...');
  const driverIds = [];
  for (let i = 0; i < 220; i++) {
    const id = run('INSERT INTO drivers (full_name, license_number, nic_number, phone) VALUES (?, ?, ?, ?)',
      [`${pick(FIRST)} ${pick(LAST)}`, `B${pad(1000000+i,7)}`,
       `${rndInt(1970,1999)}${pad(rndInt(1,366),3)}${pad(rndInt(1000,9999),4)}V`,
       `+9477${rndInt(1000000,9999999)}`]);
    driverIds.push(id);
  }

  // Vehicles
  console.log('   Adding 210 vehicles...');
  const vehicleList = [];
  const districtCodes = Object.keys(districtMap);
  for (let i = 1; i <= 210; i++) {
    const distCode = pick(districtCodes);
    const provCode = districtProvinceMap[distCode];
    const id = run(
      'INSERT INTO vehicles (registration_number, device_id, make, model, colour, driver_id, station_id, province_id, district_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [`${provCode} CAB-${pad(i,4)}`, `DEV-${pad(i,4)}`, pick(MAKES), pick(MODELS), pick(COLOURS),
       driverIds[i-1] || driverIds[0], pick(stationIds).id,
       provinceMap[provCode], districtMap[distCode]]
    );
    vehicleList.push({ id, districtCode: distCode });
  }

  // Location history (7 days)
  console.log('   Generating 7-day location history (this takes ~30s)...');
  let totalPings = 0;
  const now = Date.now();

  for (const v of vehicleList) {
    const coords = DISTRICT_COORDS[v.districtCode] || [6.9271, 79.8612];
    let lat = coords[0] + rnd(-0.02, 0.02);
    let lng = coords[1] + rnd(-0.02, 0.02);

    for (let day = 7; day >= 0; day--) {
      if (Math.random() < 0.15) continue;
      const startHour = rndInt(6, 8);
      const endHour   = rndInt(19, 22);

      for (let h = startHour; h < endHour; h++) {
        for (let m = 0; m < 60; m += 5) {
          const t = new Date(now - day * 86400000);
          t.setHours(h, m, 0, 0);
          if (t.getTime() > now) continue;

          lat += rnd(-0.001, 0.001);
          lng += rnd(-0.001, 0.001);
          lat = Math.max(5.9, Math.min(9.9, lat));
          lng = Math.max(79.5, Math.min(81.9, lng));

          batchRun('INSERT INTO location_pings (vehicle_id, latitude, longitude, speed, heading, accuracy, pinged_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [v.id, parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6)),
             parseFloat(rnd(0,55).toFixed(1)), parseFloat(rnd(0,360).toFixed(0)),
             parseFloat(rnd(3,12).toFixed(1)), t.toISOString()]);
          totalPings++;
        }
      }
    }
  }
  saveDatabase();
  console.log(`   ✓ ${totalPings.toLocaleString()} location pings inserted.`);

  // Users
  console.log('   Adding system users...');
  const pw    = await bcrypt.hash('Admin@1234', 12);
  const devPw = await bcrypt.hash('Device@5678', 12);

  run('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)',
    ['admin', pw, 'System Administrator', 'ADMIN']);
  run('INSERT INTO users (username, password, full_name, role, province_id) VALUES (?, ?, ?, ?, ?)',
    ['wp_officer', pw, 'WP Provincial Officer', 'PROVINCIAL', provinceMap['WP']]);
  run('INSERT INTO users (username, password, full_name, role, district_id, province_id) VALUES (?, ?, ?, ?, ?, ?)',
    ['cmb_officer', pw, 'Colombo District Officer', 'DISTRICT', districtMap['CMB'], provinceMap['WP']]);
  run('INSERT INTO users (username, password, full_name, role, province_id) VALUES (?, ?, ?, ?, ?)',
    ['np_officer', pw, 'Northern Province Officer', 'PROVINCIAL', provinceMap['NP']]);
  for (let i = 0; i < 5; i++) {
    run('INSERT INTO users (username, password, full_name, role, vehicle_id) VALUES (?, ?, ?, ?, ?)',
      [`device_dev_${pad(i+1,4)}`, devPw, `Device DEV-${pad(i+1,4)}`, 'DEVICE', vehicleList[i].id]);
  }

  saveDatabase();

  console.log('\n✅ Seed complete!\n');
  console.log('   Default credentials:');
  console.log('   ┌────────────────────────────────────────────────────┐');
  console.log('   │  Role        Username          Password            │');
  console.log('   │  ADMIN       admin             Admin@1234          │');
  console.log('   │  PROVINCIAL  wp_officer        Admin@1234          │');
  console.log('   │  DISTRICT    cmb_officer       Admin@1234          │');
  console.log('   │  PROVINCIAL  np_officer        Admin@1234          │');
  console.log('   │  DEVICE      device_dev_0001   Device@5678         │');
  console.log('   └────────────────────────────────────────────────────┘\n');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

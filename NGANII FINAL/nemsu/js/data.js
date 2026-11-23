/* =====================================================================
   NEMSU Cantilan 3D Campus Navigator — DATA FILE (edit me!)
   ONE merged layout = hand-drawn "Layout 1" + "Continuation of Layout 1".
   Positions are written in SKETCH pixels (x → east, y → south) and scaled
   by K so the engine works in "map units" (1 unit ≈ 0.41 m).
     • Layout 1 sketch  → used as is.
     • Continuation     → shifted by (+1960, +160) so the AVC Building
                          (drawn on both sheets) lines up.
   Descriptions, offices, rooms and hours are SAMPLE TEXT — please verify.
   ===================================================================== */
window.NEMSU = window.NEMSU || {};

const K = 0.42;                              // sketch px → map units
const E = (a, b, c, d) => [a + 1960, b + 160, c + 1960, d + 160];   // continuation sheet → world
const pt  = p => [p[0] * K, p[1] * K];
const line = pts => pts.map(pt);

NEMSU.K = K;
NEMSU.METERS_PER_UNIT = 0.41;
NEMSU.WALK_SPEED_M_PER_MIN = 80;
NEMSU.TIMEZONE = 'Asia/Manila';

/* ---------- Categories (marker colours = filter chip colours) ---------- */
NEMSU.CATEGORIES = [
  { id: 'classes',  label: 'Classes',            color: '#2f7df6' },
  { id: 'offices',  label: 'Offices & Services', color: '#f59e0b' },
  { id: 'dorms',    label: 'Dormitories',        color: '#a45cf0' },
  { id: 'sports',   label: 'Sports & Events',    color: '#22b35e' },
  { id: 'more',     label: 'More',               color: '#14a3a8' }
];

const OFFICE_HRS = { label: 'Mon–Fri 8:00 AM – 5:00 PM', days: [1,2,3,4,5], open: '08:00', close: '17:00' };
const CLASS_HRS  = { label: 'Mon–Sat 7:00 AM – 8:00 PM', days: [1,2,3,4,5,6], open: '07:00', close: '20:00' };
const LIB_HRS    = { label: 'Mon–Fri 8:00 AM – 5:00 PM · Sat 8:00 AM – 12:00 NN', days: [1,2,3,4,5,6], open: '08:00', close: '17:00', satClose: '12:00' };
const SPORT_HRS  = { label: 'Daily 6:00 AM – 9:00 PM', days: [0,1,2,3,4,5,6], open: '06:00', close: '21:00' };
const DORM_HRS   = { label: 'Open 24 hours (curfew rules apply)', days: [0,1,2,3,4,5,6], open: '00:00', close: '24:00' };

/* box = [x0, y0, x1, y1] in sketch pixels. roof: flat | hip | gable | shed | arch */
function bld(o) {
  const [x0, y0, x1, y1] = o.box;
  return Object.assign({ x: (x0 + x1) / 2 * K, y: (y0 + y1) / 2 * K, w: (x1 - x0) * K, h: (y1 - y0) * K, rot: 0, aliases: [], offices: [], rooms: [], hours: CLASS_HRS }, o);
}
const CREAM = '#efe3c0', CONC = '#d3cdbd';

NEMSU.BUILDINGS = [
 /* ============ NORTH SIDE (Layout 1) ============ */
 bld({ id:'dcs', name:'DCS Building', short:'DCS', cat:'classes', box:[350,100,810,225], floors:3, roof:'flat',
   look:{ wall:'#efe5c8', roofC:CONC, trim:'#2f6fe0', fins:'end', balcony:true },
   photo:'dcs-building.jpg', aliases:['dcs','computer studies','computing','it department','ccs'],
   desc:'A three-storey classroom building with a bright blue finned façade and long open corridors. Home of the computer studies courses, with lecture rooms and computer laboratories.',
   offices:['Department Chair Office','Faculty Room'], rooms:['Computer Laboratories 1–3','Lecture Rooms 101–309'],
   tip:'Top (north) row of the campus — look for the blue vertical fins.' }),
 bld({ id:'unfinished', name:'Unfinished Building', short:'Unfinished', cat:'more', box:[80,80,270,160], floors:2, roof:'flat',
   look:{ wall:'#bdb7a8', roofC:'#a9a496', trim:'#8a8472' }, photo:null, aliases:['unfinished','construction','new building'],
   desc:'A building still under construction beside the DCS Building. It is not open to students yet.',
   offices:[], rooms:['Under construction'], hours:OFFICE_HRS, tip:'Not open yet — next to the DCS Building and a waiting area.' }),
 bld({ id:'ccje', name:'CCJE Building', short:'CCJE', cat:'classes', box:[0,190,105,590], floors:3, roof:'flat',
   look:{ wall:'#e4d6aa', roofC:'#cfc9b8', trim:'#2f6fe0', balcony:true, stripe:'blue' },
   photo:'ccje-building.jpg', aliases:['ccje','ccie','criminology','criminal justice'],
   desc:'A long three-storey building with continuous corridors on every floor and a blue end wall. Lecture rooms face the Ground.',
   offices:['Dean’s Office','Faculty Room'], rooms:['Classrooms 101–305'],
   tip:'The long building on the far west side, facing the Ground.' }),
 bld({ id:'ground', name:'Open Court', short:'Open Court', cat:'sports', box:[1055,90,1495,385], floors:1, roof:'arch', rot:24, w2:400, h2:175, center:[1266,228],
   look:{ wall:'#7cb8f0', roofC:'#5a8fd8', trim:'#2f6fe0', court:true },
   photo:null, aliases:['open court','covered court','court','basketball','events','assembly'],
   desc:'The covered open court at the top of the campus, used for sports, assemblies, orientation programs and school events.',
   offices:['Sports Office'], rooms:['Main Court','Stage'], hours:SPORT_HRS, tip:'North of the Ground, beside the DCS Building side of campus.' }),
 bld({ id:'dbm1', name:'DBM Building 1', short:'DBM 1', cat:'classes', box:[1300,490,1395,820], floors:2, roof:'flat',
   look:{ wall:'#e8dcb4', roofC:'#d6d1c3', trim:'#3a6fd0', balcony:true },
   photo:'dbm-building-1.jpg', aliases:['dbm','dbm 1','business','management'],
   desc:'A long two-storey classroom building with a continuous upper corridor, standing beside the overpass.',
   offices:['Faculty Room'], rooms:['Classrooms 101–210'], tip:'The tall vertical building just north of the overpass.' }),
 bld({ id:'cca', name:'Culture of Arts (CCA) Gymnasium', short:'CCA Gym', cat:'sports', box:[1460,470,1780,830], floors:2, roof:'arch',
   look:{ wall:'#a9cdf2', roofC:'#3a74d8', trim:'#2f6fe0', base:'#c9dff5' },
   photo:'culture-of-arts-gymnasium.jpg', aliases:['cca','culture of arts','culture and arts','gym','gymnasium','arts'],
   desc:'The big blue-roofed Culture of Arts gymnasium. It hosts performances, sports and big school events.',
   offices:['Culture & Arts Office'], rooms:['Main Gym Floor','Stage','Dressing Rooms'], hours:SPORT_HRS,
   tip:'The biggest building north of the main road, close to Gate 5.' }),
 /* ---- north of the main road, west → east ---- */
 bld({ id:'science', name:'Science Building', short:'Science', cat:'classes', box:[0,780,250,880], floors:2, roof:'hip',
   look:{ wall:'#f1e8cf', roofC:'#a8483f', trim:'#8a3a34', arcade:true, wing:{ dx:-85*K, dy:-62*K, w:80*K, h:70*K } },
   photo:'science-building.jpg', aliases:['science','biology','chemistry'],
   desc:'An L-shaped two-storey building with a red hip roof and a covered walkway. Science lecture rooms and laboratories.',
   offices:['Science Department Office'], rooms:['Biology Lab','Chemistry Lab','Lecture Rooms 1–6'],
   tip:'Red roof, on the west end near Gate 4.' }),
 bld({ id:'spl', name:'Science Physics Laboratory', short:'Physics Lab', cat:'classes', box:[290,785,485,890], floors:1, roof:'hip',
   look:{ wall:'#efe6cf', roofC:'#2d5fc8', trim:'#2d5fc8', chimney:true },
   photo:'science-physics-laboratory.jpg', aliases:['physics','physics lab','laboratory','science lab'],
   desc:'A single-storey laboratory with a bright blue roof and central tower, used for physics and science experiments.',
   offices:['Laboratory Custodian'], rooms:['Physics Laboratory','Preparation Room'], tip:'Blue roof, between the Science and R&D buildings.' }),
 bld({ id:'rnd', name:'Research Development Extension Building', short:'R&D', cat:'offices', box:[590,755,790,900], floors:4, roof:'flat',
   look:{ wall:'#b9b2a2', roofC:'#8d887c', trim:'#6f6a60', glass:'bottom' },
   photo:'research-development-extension-building.jpg', aliases:['r&d','rnd','research','extension','rde','research development'],
   desc:'The Research, Development and Extension building — a four-storey concrete block with large glass panels. Research and community extension work is coordinated here.',
   offices:['Research Office','Extension Services Office'], rooms:['Conference Room','Research Laboratory'], hours:OFFICE_HRS,
   tip:'Gray concrete building right beside Gate 4.' }),
 bld({ id:'nstp', name:'NSTP Building', short:'NSTP', cat:'offices', box:[805,805,955,900], floors:2, roof:'shed',
   look:{ wall:'#efd98e', roofC:'#8a5a3a', trim:'#1f8a6a', balcony:true },
   photo:'nstp-building.jpg', aliases:['nstp','rotc','cwts','national service'],
   desc:'A small two-storey building with a green-railed balcony and an open lower deck. National Service Training Program activities are organised here.',
   offices:['NSTP Office'], rooms:['Training Room','Storage'], hours:OFFICE_HRS, tip:'Between the R&D Building and the Half Court.' }),
 bld({ id:'half', name:'Half Court', short:'Half Court', cat:'sports', box:[970,825,1060,900], floors:1, roof:'flat',
   look:{ wall:'#c9714b', roofC:'#c9714b', court:true, noroof:true }, photo:null, aliases:['half court','court','basketball','play'],
   desc:'An open half basketball court for casual games and student activities.',
   offices:[], rooms:['Open court'], hours:SPORT_HRS, tip:'Small open court between the NSTP and DBM 2 buildings.' }),
 bld({ id:'dbm2', name:'DBM Building 2', short:'DBM 2', cat:'classes', box:[1075,775,1265,905], floors:2, roof:'hip',
   look:{ wall:'#f0e1a8', roofC:'#9c4a3d', trim:'#a63f36', balcony:true, arcade:true },
   photo:'dbm-building-2.jpg', aliases:['dbm','dbm 2','business','management'],
   desc:'A two-storey building with a red hip roof, wooden stairs and a railed upper walkway. Business and management classes meet here.',
   offices:['Program Head Office'], rooms:['Classrooms 1–4'], tip:'Right next to the overpass on the north side.' }),

 /* ============ SOUTH SIDE (Layout 1) ============ */
 bld({ id:'dgtt', name:'DGTT Building', short:'DGTT', cat:'classes', box:[175,1175,730,1365], floors:2, roof:'flat',
   look:{ wall:'#f0e0a0', roofC:'#d2cdbd', fascia:'#2a55b0', trim:'#2a55b0', arcade:true, balcony:true, base:'#a84a3a' },
   photo:'dgtt-building-1.jpg', photo2:'dgtt-building-2.jpg', aliases:['dgtt','dggtt','guidance','education','cr','restroom'],
   desc:'A long two-storey classroom building with a blue roof edge, upper balcony and an open ground-floor arcade.',
   offices:['Department Office','Guidance Room'], rooms:['Classrooms 101–220','Restrooms (each floor)'],
   tip:'South of the main road, west part. Joined to the Library Building.' }),
 bld({ id:'library', name:'Library Building', short:'Library', cat:'offices', box:[730,1175,1095,1365], floors:2, roof:'flat',
   look:{ wall:'#f2e3a6', roofC:'#d2cdbd', fascia:'#2a55b0', trim:'#2a55b0', arcade:true, balcony:true, base:'#a84a3a' },
   photo:'library-building.jpg', aliases:['library','books','study','reading','wifi','internet'],
   desc:'The campus library with a reading area, book stacks and study tables. A blue balcony runs along the front.',
   offices:['Librarian’s Office','Circulation Desk'], rooms:['Reading Hall','Computer Section','Study Area'], hours:LIB_HRS,
   tip:'Right next to the DGTT Building — look for the blue balcony.' }),
 bld({ id:'apartelle', name:'Apartelle Building', short:'Apartelle', cat:'dorms', box:[1140,1195,1255,1535], floors:1, roof:'hip',
   look:{ wall:'#f3e4a8', roofC:'#6b5b54', trim:'#a63f36', base:'#a84a3a' },
   photo:'apartelle-building-2.jpg', photo2:'apartelle-building-1.jpg', aliases:['apartelle','guest house','lodging','visitor','travel agency'],
   desc:'A long one-storey building with a dark hip roof used as guest and visitor lodging. A small travel agency office is at the front.',
   offices:['Apartelle Caretaker','Travel Agency'], rooms:['Guest Rooms','Common Area'], hours:DORM_HRS, tip:'Tall narrow building just east of the Library.' }),
 bld({ id:'admin', name:'Administrative Office Building', short:'Admin Office', cat:'offices', box:[1730,1060,2035,1200], floors:2, roof:'hip',
   look:{ wall:'#f3e5ac', roofC:'#8b5a46', trim:'#b0372d', balcony:true, arcade:true, base:'#a84a3a' },
   photo:'administrative-office-building.jpg',
   aliases:['admin','administration','registrar','cashier','clinic','president','accounting','enrollment','enrolment','records','id','scholarship'],
   desc:'The main administrative building — a two-storey wooden-trimmed building with a covered veranda where students line up for enrolment and payments. Most first-year transactions happen here.',
   offices:['Registrar’s Office','Cashier','Accounting Office','Clinic / Health Services','Office of the Campus Director'], rooms:['Enrollment Area','Records Room'],
   hours:OFFICE_HRS, tip:'Right across the main road from the overpass, near Gate 2.' }),
 bld({ id:'alumni', name:'Alumni Building', short:'Alumni', cat:'offices', box:[1520,1240,1715,1385], floors:1, roof:'hip',
   look:{ wall:'#f1e3a8', roofC:'#9a4339', trim:'#a63f36', base:'#a84a3a' },
   photo:'alumni-building.jpg', aliases:['alumni','alumni room','canteen','cafeteria','food','snack'],
   desc:'A single-storey building with a reddish hip roof, covered entry and garden. It serves as the alumni office and meeting room.',
   offices:['Alumni Affairs Office'], rooms:['Meeting Room'], hours:OFFICE_HRS, tip:'South of the main road, just west of the Old Science Building.' }),
 bld({ id:'oldsci', name:'Old Science Building', short:'Old Science', cat:'classes', box:[1735,1250,1925,1435], floors:1, roof:'hip',
   look:{ wall:'#efe3c4', roofC:'#9a5a46', trim:'#a63f36', arcade:true },
   photo:'old-science-building-2.jpg', aliases:['old science','science','laboratory'],
   desc:'The older science block with long covered corridors and classrooms.',
   offices:['Laboratory Custodian'], rooms:['Science Classrooms','Laboratory Rooms'], tip:'South-east of the Admin Office, beside the SAO.' }),
 bld({ id:'sao', name:'SAO (Student Affairs Office)', short:'SAO', cat:'offices', box:[1930,1245,2010,1350], floors:1, roof:'flat',
   look:{ wall:'#efe4c2', roofC:'#d1ccbd', trim:'#2d5fc8' }, photo:'sao-bulding.jpg',
   aliases:['sao','student affairs','student services','organizations','discipline'],
   desc:'The Student Affairs Office handles student organizations, activities, discipline and student services.',
   offices:['Student Affairs Office','Student Organizations Room'], rooms:['Counseling Corner'], hours:OFFICE_HRS, tip:'Attached to the east side of the Old Science Building.' }),
 bld({ id:'newhotel', name:'New Hotel Building', short:'New Hotel', cat:'dorms', box:[5,1395,315,1590], floors:2, roof:'flat',
   look:{ wall:'#e6edf5', roofC:'#cfd8e3', trim:'#4d8fe0', balcony:false, stripe:'blue' },
   photo:'new-hotel-building.jpg', aliases:['new hotel','hotel','lodging','guest'],
   desc:'A modern two-storey hotel building with blue fins and glass façade for guests and visitors.',
   offices:['Front Desk'], rooms:['Guest Rooms','Lobby'], hours:DORM_HRS, tip:'South-west corner of the campus.' }),
 bld({ id:'mdorm', name:'Male Dormitory', short:'Male Dorm', cat:'dorms', box:[330,1400,1100,1560], floors:2, roof:'flat',
   look:{ wall:'#ece7de', roofC:'#d0ccc2', trim:'#b46a8a', balcony:true, stripe:'pink' },
   photo:'male-dormitory.jpg', aliases:['male dorm','dormitory','dorm','boarding','boys'],
   desc:'A two-storey dormitory with open corridors, outside stairs and a shaded lounge area on the ground floor.',
   offices:['Dorm Manager'], rooms:['Dorm Rooms','Common Lounge'], hours:DORM_HRS, tip:'South of the DGTT and Library buildings.' }),
 bld({ id:'minihotel', name:'Mini Hotel Building', short:'Mini Hotel', cat:'dorms', box:[1265,1485,1510,1590], floors:1, roof:'hip',
   look:{ wall:'#f1e0a4', roofC:'#9a4339', trim:'#a63f36' }, photo:'mini-hotel-building.jpg', aliases:['mini hotel','hotel','lodging'],
   desc:'A small one-storey guest house with a red hip roof and garden.',
   offices:['Caretaker'], rooms:['Guest Rooms'], hours:DORM_HRS, tip:'South of the Apartelle, next to the Fish Dryer Building.' }),
 bld({ id:'fish', name:'Fish Dryer Building', short:'Fish Dryer', cat:'more', box:[1525,1500,1675,1590], floors:1, roof:'gable',
   look:{ wall:'#f1e3a0', roofC:'#d8d3c3', trim:'#8a6a4a' }, photo:'fish-dryer-building.jpg', aliases:['fish dryer','fisheries','fish','drying'],
   desc:'A single-storey fisheries processing building used for fish-drying demonstrations and projects.',
   offices:['Fisheries Project Office'], rooms:['Drying Room','Storage'], hours:OFFICE_HRS, tip:'South of the Alumni Building.' }),
 bld({ id:'avc', name:'AVC Building', short:'AVC', cat:'more', box:[1900,1450,2320,1710], floors:2, roof:'hip',
   look:{ wall:'#f0dc98', roofC:'#8d5845', trim:'#b0372d', balcony:true }, photo:'avc-building.jpg',
   aliases:['avc','audio visual','audio-visual','seminar','multimedia'],
   desc:'The Audio-Visual Center — a two-storey building with a railed veranda and a shaded garden hut. Seminars, screenings and events are held here.',
   offices:['AVC Coordinator'], rooms:['Audio-Visual Hall','Seminar Room'], tip:'South-east, shown on both layout sheets.' }),

 /* ============ EAST EXTENSION (Continuation sheet) ============ */
 bld({ id:'rfid', name:'RFID Building', short:'RFID', cat:'offices', box:E(120,930,320,1040), floors:1, roof:'flat',
   look:{ wall:'#eadfc0', roofC:'#2d5fc8', trim:'#2d5fc8', fascia:'#2d5fc8' }, photo:'rfid-building.jpg', aliases:['rfid','id','student id','id card','card'],
   desc:'The RFID building where student ID cards and campus entry cards are processed.',
   offices:['ID Processing Office'], rooms:['ID Counter'], hours:OFFICE_HRS, tip:'Right beside Gate 1 on the east side.' }),
 bld({ id:'netlab', name:'Internet Laboratory', short:'Internet Lab', cat:'classes', box:E(490,925,685,1025), floors:1, roof:'hip',
   look:{ wall:'#f0e1a8', roofC:'#8a4036', trim:'#8a4036' }, photo:'internet-laboratory.jpg', aliases:['internet','internet lab','computer lab','wifi','cyber'],
   desc:'A single-storey laboratory with internet-connected computers for research and online classes.',
   offices:['Lab Attendant'], rooms:['Internet Laboratory'], tip:'East of Gate 1, facing the main road.' }),
 bld({ id:'mk1', name:'Makeshift Classroom 1', short:'Makeshift 1', cat:'classes', box:E(750,920,975,1040), floors:1, roof:'shed',
   look:{ wall:'#d4cd78', roofC:'#2d5fc8', trim:'#d4cd78' }, photo:'makeshift-classroom-1.jpg', aliases:['makeshift','makeshift classroom','temporary classroom'],
   desc:'A temporary open-sided classroom with a blue roof, used while permanent classrooms are being built.',
   offices:[], rooms:['Classroom area'], tip:'East of the Internet Laboratory.' }),
 bld({ id:'mk2', name:'Makeshift Classroom 2', short:'Makeshift 2', cat:'classes', box:E(1000,920,1200,1035), floors:1, roof:'shed',
   look:{ wall:'#d4cd78', roofC:'#2d5fc8', trim:'#d4cd78' }, photo:'makeshift-classroom-2.jpg', aliases:['makeshift','makeshift classroom','temporary classroom'],
   desc:'A second temporary open-sided classroom with a blue roof.', offices:[], rooms:['Classroom area'], tip:'Next to Makeshift Classroom 1.' }),
 bld({ id:'auto', name:'Automotive Technology', short:'Automotive', cat:'classes', box:E(1090,1075,1300,1275), floors:1, roof:'gable',
   look:{ wall:'#efe1b0', roofC:'#9a8f86', trim:'#6a5a4a' }, photo:'automotive-building.jpg', aliases:['automotive','auto','mechanic','technology','engine'],
   desc:'The automotive technology workshop building, with a large garage door for vehicle and engine practice.',
   offices:['Instructor’s Office'], rooms:['Auto Workshop'], tip:'South-east, behind the Makeshift classrooms.' }),
 bld({ id:'eet', name:'Electrical Electronics Tech', short:'Electrical', cat:'classes', box:E(1315,1075,1510,1275), floors:1, roof:'gable',
   look:{ wall:'#eee0aa', roofC:'#a29a8d', trim:'#2e7a5a' }, photo:'electrical-electronics-building.jpg', aliases:['electrical','electronics','eet','electricity','wiring'],
   desc:'The electrical and electronics technology building for wiring, circuits and electronics practice.',
   offices:['Instructor’s Office'], rooms:['Electrical Workshop','Electronics Lab'], tip:'Right beside Automotive Technology.' }),
 bld({ id:'coop', name:'Coop Building', short:'Coop', cat:'offices', box:E(1595,1100,1865,1280), floors:1, roof:'hip',
   look:{ wall:'#f1e1a4', roofC:'#8b4f3a', trim:'#a63f36' }, photo:'coop-building.jpg', aliases:['coop','cooperative','multi-purpose','canteen','store','snack'],
   desc:'The multi-purpose cooperative building. Students can buy snacks, school supplies and drinks here.',
   offices:['Cooperative Office'], rooms:['Store'], hours:OFFICE_HRS, tip:'East side, near the Female Dormitory.' }),
 bld({ id:'fdorm', name:'Female Dormitory', short:'Female Dorm', cat:'dorms', box:E(2010,1100,2140,1510), floors:3, roof:'flat',
   look:{ wall:'#f1ede6', roofC:'#d6d1c3', trim:'#8a3a3a', balcony:true, stripe:'maroon' }, photo:'female-dormitory.jpg', aliases:['female dorm','dormitory','dorm','girls'],
   desc:'A three-storey dormitory with a landscaped courtyard in front.',
   offices:['Dorm Manager'], rooms:['Dorm Rooms','Common Area'], hours:DORM_HRS, tip:'Far east of the campus.' }),
 bld({ id:'dit', name:'DIT Building', short:'DIT', cat:'classes', box:[2325,1450,3040,1710], floors:1, roof:'hip',
   look:{ wall:'#efe0a8', roofC:'#a8483f', trim:'#a63f36', arcade:true }, photo:'dit-building.jpg', aliases:['dit','industrial technology','workshop'],
   desc:'A long single-storey building with a red roof and a garden courtyard. Industrial technology classes and workshops are held here.',
   offices:['DIT Department Office'], rooms:['Workshops','Classrooms'], tip:'South-east, a long red-roofed building next to the AVC.' })
];
/* number them in list order */
NEMSU.BUILDINGS.forEach((b, i) => { b.n = i + 1; });
/* the Open Court is rotated: fix its size/centre (rotated rectangle in the sketch) */
(function () { const c = NEMSU.BUILDINGS.find(b => b.id === 'ground'); c.x = 1266 * K; c.y = 228 * K; c.w = 400 * K; c.h = 175 * K; })();

/* Small non-interactive buildings */
NEMSU.DECOR = [
  { x: 315 * K, y: 137 * K, w: 50 * K, h: 95 * K, floors: 1, roof: 'flat', look: { wall: '#e7dec5', roofC: '#bfb9a8', trim: '#8a8472' } },    // waiting area (by DCS)
  { x: 30 * K,  y: 662 * K, w: 60 * K, h: 105 * K, floors: 1, roof: 'flat', look: { wall: '#e7dec5', roofC: '#bfb9a8', trim: '#8a8472' } },   // waiting area (by CCJE)
];

/* ---------- Gates ---------- */
NEMSU.GATES = [
  /* style = how the gate is drawn (copied from the Street View screenshots):
       welcome = blue "WELCOME" arch + dark university sign wall (Gate 1)
       red     = red SDS gate, red pillars, white picket fence, wooden guard post (Gate 4)
       tan     = blue leaf gate between tan pillars, grey pergola, stone guard house (Gate 5)
       blue    = plain blue steel gate (Gates 2 and 6) */
  { id:'gate1', name:'Gate 1 (Main Gate)', x:2362*K, y:1090*K, style:'welcome' },
  { id:'gate2', name:'Gate 2 (Overpass)', x:1530*K, y:1075*K, style:'blue' },
  { id:'gate4', name:'Gate 4', x:530*K, y:912*K, style:'red' },
  { id:'gate5', name:'Gate 5', x:1620*K, y:912*K, style:'tan' },
  { id:'gate6', name:'Gate 6 (South Gate)', x:3215*K, y:1655*K, style:'blue' }
];

/* ---------- Main road + walkways ---------- */
NEMSU.ROADS = [{ w: 124 * K, pts: line([[-300, 990], [4500, 990]]), dash: true, main: true }];

/* Walkways (pedestrian paths). over:true = elevated overpass. The router uses these. */
NEMSU.WALKS = [
  { pts: line([[-300, 912], [4500, 912]]) },                 // north sidewalk
  { pts: line([[-300, 1068], [4500, 1068]]) },               // south sidewalk
  { pts: line([[1355, 912], [1355, 1068]]), over: true },    // OVERPASS
  /* north interior */
  { pts: line([[122, 240], [1430, 240]]) }, { pts: line([[122, 240], [122, 745]]) }, { pts: line([[122, 745], [1285, 745]]) },
  { pts: line([[1285, 240], [1285, 912]]) }, { pts: line([[1430, 240], [1430, 912]]) }, { pts: line([[1800, 470], [1800, 912]]) },
  { pts: line([[270, 745], [270, 912]]) }, { pts: line([[540, 745], [540, 912]]) },
  /* south interior */
  { pts: line([[100, 1068], [100, 1385]]) }, { pts: line([[100, 1385], [1130, 1385]]) },
  { pts: line([[1117, 1068], [1117, 1620]]) }, { pts: line([[1390, 1068], [1390, 1485]]) }, { pts: line([[1390, 1440], [1725, 1440]]) },
  { pts: line([[1725, 1068], [1725, 1440]]) }, { pts: line([[2045, 1068], [2045, 1440]]) }, { pts: line([[1930, 1440], [3300, 1440]]) },
  { pts: line([[2362, 1068], [2362, 1440]]) }, { pts: line([[2362, 1218], [3930, 1218]]) }, { pts: line([[3267, 1218], [3267, 1440]]) },
  { pts: line([[3215, 1440], [3215, 1665]]) }, { pts: line([[3930, 1068], [3930, 1660]]) }
];

/* Fields, plazas, walls, captions, trees */
NEMSU.FIELDS = [ { name: 'GROUND', pts: line([[140, 250], [1272, 250], [1272, 738], [140, 738]]) } ];
NEMSU.PLAZAS = [];   // parking block removed (all gravel now)
NEMSU.WALLS = [
  line([[-130, 1100], [78, 1100]]), line([[122, 1100], [1090, 1100]]),      // "WALL" south of the main road (Layout 1), walk-gate gap at x=100
  line([[2380, 370], [2380, 880]]), line([[2070, 930], [2380, 930]]),       // wall on the continuation sheet (gap where the north walkway passes)
  line([[3045, 1655], [3128, 1655]]), line([[3302, 1655], [3485, 1655]])    // south wall either side of Gate 6
];
/* Walls on both sides of EVERY gate (a gap is left for the gate itself). half = wall length each side, gap = half-width of the opening (sketch px). */
[{ id:'gate1', half:200, gap:26 }, { id:'gate2', half:120, gap:26 }, { id:'gate4', half:200, gap:26 }, { id:'gate5', half:150, gap:26 }]
  .forEach(o => { const g = NEMSU.GATES.find(g => g.id === o.id), x = g.x / K, y = g.y / K;
    NEMSU.WALLS.push(line([[x - o.half, y], [x - o.gap, y]]), line([[x + o.gap, y], [x + o.half, y]])); });
NEMSU.WALLS.push(line([[3128, 1655], [3189, 1655]]), line([[3241, 1655], [3302, 1655]]));   // Gate 6: close the old wide gap, leave the gate opening
NEMSU.EXTRA_ARCHES = [];                                                     // (removed: no extra gate in the south wall; the wall gap at x=100 stays open)
NEMSU.CAPTIONS = [
  { t: 'GROUND', x: 700, y: 490, size: 16 }, { t: 'MAIN ROAD', x: 1900, y: 990, size: 9, light: true },
  { t: 'OVERPASS', x: 1355, y: 990, size: 7, light: true }, { t: 'PATHWAY', x: 640, y: 1130, size: 11 }
];
NEMSU.PALMS = [{ x0: 200, x1: 1060, y: 1128 }];
NEMSU.TREES = [[1620,300],[1900,350],[2100,300],[2300,500],[2500,250],[2700,600],[2900,300],[3200,500],[3600,300],[3900,600],[4100,350],[2500,760],[3000,780],[3500,800],[3900,800],[1950,640],[1500,150],[1700,200],[250,1640],[900,1650],[1200,1660],[1450,1420],[1800,1560],[3400,1380],[3700,1420],[3500,1740],[200,1130],[1260,1140],[1900,1580],[2900,1330],[160,320],[160,520],[160,690],[1240,330],[1240,520],[1240,690]];

/* ---------- Facilities layer (sample positions — edit!) ---------- */
NEMSU.FACILITY_TYPES = [
  { id:'restroom', label:'Restrooms', icon:'🚻', color:'#0ea5b7' },
  { id:'canteen',  label:'Canteen / Store', icon:'🍽️', color:'#ef7d1a' },
  { id:'ramp',     label:'Ramps',     icon:'♿', color:'#2e9e5b' },
  { id:'waiting',  label:'Waiting areas', icon:'🪑', color:'#8a6bd1' }
];
NEMSU.FACILITIES = [
  { type:'restroom', name:'Restrooms — DGTT',     x:300, y:1260 }, { type:'restroom', name:'Restrooms — Library', x:900, y:1260 },
  { type:'restroom', name:'Restrooms — DCS',      x:700, y:240 },  { type:'restroom', name:'Restrooms — Admin',   x:1900, y:1215 },
  { type:'restroom', name:'Restrooms — CCA Gym',  x:1620, y:850 },
  { type:'canteen',  name:'Coop store (Coop Building)', x:3690, y:1350 }, { type:'canteen', name:'Canteen (sample spot)', x:1620, y:1330 },
  { type:'ramp',     name:'Ramp — Library entrance', x:910, y:1385 }, { type:'ramp', name:'Ramp — Admin Office', x:1760, y:1215 }, { type:'ramp', name:'Ramp — CCA Gym', x:1620, y:845 },
  { type:'waiting',  name:'Waiting Area (by DCS)', x:315, y:137 }, { type:'waiting', name:'Waiting Area (by CCJE)', x:30, y:662 }
].map(f => Object.assign(f, { x: f.x * K, y: f.y * K }));

/* ---------- Overpass over the main road ---------- */
NEMSU.OVERPASS = { a: pt([1355, 880]), b: pt([1355, 1100]), width: 14, height: 15 };

/* ---------- Freshman Guide tour — EDIT THIS ARRAY ---------- */
NEMSU.TOUR = [
  { title:'Enter through the Main Gate', target:'gate1', zoom:3.0,
    tip:'Gate 1 is the main gate, with the blue WELCOME arch. Gate 2 and the overpass over the main road are further west.' },
  { title:'Registrar’s Office', target:'admin', zoom:3.2,
    tip:'Get your enrolment form, Form 137 and student records here. Bring 2 ID photos and a pen.' },
  { title:'Cashier', target:'admin', zoom:3.2,
    tip:'Pay tuition and other fees at the Cashier window, then keep your official receipt for your ID.' },
  { title:'Clinic / Health Services', target:'admin', zoom:3.2,
    tip:'Submit your medical requirements and ask for first aid here. Ask the staff for the exact room and hours.' },
  { title:'Library', target:'library', zoom:3.0,
    tip:'Borrow books, use study tables and ask the librarian about the library card.' },
  { title:'My Department', target:'dcs', zoom:2.6, type:'department',
    tip:'Pick your own department below. Your first classes and faculty room are here.' }
];
NEMSU.DEFAULT_CAM = { x: 868, y: 345, yaw: 0, tilt: 48, zoom: 0.455 };

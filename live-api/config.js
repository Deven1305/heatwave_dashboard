// Settings, plus the fixed list of regions and cities. Nothing in this file is weather data: it only says
// WHERE to ask Open-Meteo for weather. Adding a city to the project means adding one line to STATIONS below.
// Most numbers can be overridden with environment variables (see .env.example); the right-hand side is the default.

export const PORT = Number(process.env.LIVE_API_PORT) || 4300;
export const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017';
export const DB_NAME = process.env.LIVE_DB_NAME || 'climateintel_live';
export const REFRESH_MINUTES = Number(process.env.REFRESH_MINUTES) || 30;
export const HISTORY_DAYS = 30;        // how many past days of daily values we ask for on every refresh
export const FORECAST_DAYS = 5;        // how many days we ask for from today on (today + 4), stored as forecast
// Which years are averaged to get each city's "normal". Why only six? Open-Meteo's free plan allows about 5,000
// "weighted calls" an hour and a year of daily data for one city costs about 26 of them, so 6 years x 30 cities is
// roughly 4,700: it just fits in one hour. A longer period (NORMAL_START_YEAR=2015) works too, but the first start
// then needs a couple of hours to finish because we have to wait for the quota to refill.
export const NORMAL_YEARS = [Number(process.env.NORMAL_START_YEAR) || 2019, 2024];
export const FRESH_MINUTES = 180;      // a city counts as "reporting" if its latest reading is newer than this (minutes)

export const TIERS = ['Safe', 'Watch', 'Warning', 'Emergency']; // alert levels, mildest first (the position is the level number)

// The 7 regions. The names are spelled exactly like the choices in the observation form, so a report can be matched to a region.
export const REGIONS = [
  { id: 'north-west-india', name: 'North-West India' },
  { id: 'north-east-india', name: 'North-East India' },
  { id: 'east-india', name: 'East India' },
  { id: 'central-india', name: 'Central India' },
  { id: 'west-india', name: 'West India' },
  { id: 'south-interior-peninsula', name: 'South Interior Peninsula' },
  { id: 'south-coastal', name: 'South Coastal (incl. Islands)' },
];

// For the search box: each city's state, then extra words people might type ("himalaya", "vizag"...).
// Cities on the coast or in the hills also get "coastal" / "hills" words added automatically below.
const PLACE = {
  delhi: ['Delhi'], jaipur: ['Rajasthan'], amritsar: ['Punjab'], jodhpur: ['Rajasthan', 'thar desert'],
  srinagar: ['Jammu and Kashmir', 'himalaya himalayas kashmir valley mountain'], shimla: ['Himachal Pradesh', 'himalaya himalayas hill station mountain'],
  guwahati: ['Assam', 'brahmaputra'], agartala: ['Tripura'], imphal: ['Manipur', 'hill station valley'], dibrugarh: ['Assam', 'brahmaputra'],
  kolkata: ['West Bengal'], bhubaneswar: ['Odisha'], patna: ['Bihar', 'ganga'], ranchi: ['Jharkhand'],
  nagpur: ['Maharashtra', 'vidarbha'], bhopal: ['Madhya Pradesh'], raipur: ['Chhattisgarh'], jabalpur: ['Madhya Pradesh'],
  ahmedabad: ['Gujarat'], mumbai: ['Maharashtra', 'konkan'], pune: ['Maharashtra'], surat: ['Gujarat'],
  hyderabad: ['Telangana', 'deccan'], bengaluru: ['Karnataka', 'bangalore deccan'], madurai: ['Tamil Nadu'], kurnool: ['Andhra Pradesh', 'deccan'],
  chennai: ['Tamil Nadu', 'madras'], kochi: ['Kerala', 'cochin'], visakhapatnam: ['Andhra Pradesh', 'vizag'], 'port-blair': ['Andaman and Nicobar Islands', 'island islands'],
};
// Small helper so each city below is one short line. terrain is 'plains' unless given; it decides which
// heat limit applies (see severity.js). It also fills in the state and the search words from PLACE above.
const S = (id, name, regionId, lat, lon, terrain = 'plains') => {
  const [state, words = ''] = PLACE[id] || [''];
  const tags = [...words.split(' ').filter(Boolean), ...(terrain === 'coastal' ? ['coast', 'coastal', 'sea'] : terrain === 'hills' ? ['hills', 'hilly'] : [])];
  return { id, name, regionId, lat, lon, terrain, state, tags };
};
// The 30 cities, 4 to 6 per region. The coordinates are only the point we ask Open-Meteo about, so there is
// no weather station behind a "station" here. To add a city: add a line here (and its state/words in PLACE).
export const STATIONS = [
  S('delhi', 'Delhi', 'north-west-india', 28.61, 77.21),
  S('jaipur', 'Jaipur', 'north-west-india', 26.91, 75.79),
  S('amritsar', 'Amritsar', 'north-west-india', 31.63, 74.87),
  S('jodhpur', 'Jodhpur', 'north-west-india', 26.29, 73.02),
  S('srinagar', 'Srinagar', 'north-west-india', 34.08, 74.8, 'hills'),
  S('shimla', 'Shimla', 'north-west-india', 31.1, 77.17, 'hills'),

  S('guwahati', 'Guwahati', 'north-east-india', 26.14, 91.74),
  S('agartala', 'Agartala', 'north-east-india', 23.83, 91.28),
  S('imphal', 'Imphal', 'north-east-india', 24.82, 93.94, 'hills'),
  S('dibrugarh', 'Dibrugarh', 'north-east-india', 27.48, 94.91),

  S('kolkata', 'Kolkata', 'east-india', 22.57, 88.36),
  S('bhubaneswar', 'Bhubaneswar', 'east-india', 20.3, 85.82),
  S('patna', 'Patna', 'east-india', 25.59, 85.14),
  S('ranchi', 'Ranchi', 'east-india', 23.34, 85.31),

  S('nagpur', 'Nagpur', 'central-india', 21.15, 79.09),
  S('bhopal', 'Bhopal', 'central-india', 23.26, 77.41),
  S('raipur', 'Raipur', 'central-india', 21.25, 81.63),
  S('jabalpur', 'Jabalpur', 'central-india', 23.18, 79.95),

  S('ahmedabad', 'Ahmedabad', 'west-india', 23.02, 72.57),
  S('mumbai', 'Mumbai', 'west-india', 19.08, 72.88, 'coastal'),
  S('pune', 'Pune', 'west-india', 18.52, 73.86),
  S('surat', 'Surat', 'west-india', 21.17, 72.83),

  S('hyderabad', 'Hyderabad', 'south-interior-peninsula', 17.38, 78.48),
  S('bengaluru', 'Bengaluru', 'south-interior-peninsula', 12.97, 77.59),
  S('madurai', 'Madurai', 'south-interior-peninsula', 9.93, 78.12),
  S('kurnool', 'Kurnool', 'south-interior-peninsula', 15.83, 78.04),

  S('chennai', 'Chennai', 'south-coastal', 13.08, 80.27, 'coastal'),
  S('kochi', 'Kochi', 'south-coastal', 9.93, 76.27, 'coastal'),
  S('visakhapatnam', 'Visakhapatnam', 'south-coastal', 17.69, 83.22, 'coastal'),
  S('port-blair', 'Port Blair', 'south-coastal', 11.62, 92.73, 'coastal'),
];

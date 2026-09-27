/** City, nickname, and abbreviation forms for the same pro team. */

function normAlias(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cleanTeamName(value) {
  return String(value || '')
    .replace(/^\s*game\s+\d+\s*:\s*/i, '')
    .replace(/\s*:\s*(spread|total\s+points|total\s+runs|total\s+goals|totals?|moneyline|money\s+line)\s*$/i, '')
    .replace(/^\(\d+\)\s*/, '')
    .trim()
}

function team(league, id, names) {
  return { league, id: `${league}:${id}`, names }
}

const TEAMS = [
  // MLB
  team('mlb', 'diamondbacks', ['arizona', 'arizona diamondbacks', 'ari', 'ari diamondbacks', 'dbacks']),
  team('mlb', 'braves', ['atlanta', 'atlanta braves', 'atl', 'atl braves']),
  team('mlb', 'orioles', ['baltimore', 'baltimore orioles', 'bal', 'bal orioles']),
  team('mlb', 'redsox', ['boston', 'boston red sox', 'bos', 'bos red sox']),
  team('mlb', 'cubs', ['chicago c', 'chicago cubs', 'chc', 'chc cubs', 'cubs']),
  team('mlb', 'whitesox', ['chicago ws', 'chicago white sox', 'cws', 'chw', 'chi white sox', 'chi', 'white sox']),
  team('mlb', 'reds', ['cincinnati', 'cincinnati reds', 'cin', 'cin reds']),
  team('mlb', 'guardians', ['cleveland', 'cleveland guardians', 'cle', 'cle guardians']),
  team('mlb', 'rockies', ['colorado', 'colorado rockies', 'col', 'col rockies']),
  team('mlb', 'tigers', ['detroit', 'detroit tigers', 'det', 'det tigers']),
  team('mlb', 'astros', ['houston', 'houston astros', 'hou', 'hou astros']),
  team('mlb', 'royals', ['kansas city', 'kansas city royals', 'kc', 'kc royals']),
  team('mlb', 'angels', ['los angeles a', 'los angeles angels', 'laa', 'laa angels', 'angels']),
  team('mlb', 'dodgers', ['los angeles d', 'los angeles dodgers', 'lad', 'lad dodgers', 'dodgers']),
  team('mlb', 'marlins', ['miami', 'miami marlins', 'mia', 'mia marlins']),
  team('mlb', 'brewers', ['milwaukee', 'milwaukee brewers', 'mil', 'mil brewers']),
  team('mlb', 'twins', ['minnesota', 'minnesota twins', 'min', 'min twins']),
  team('mlb', 'mets', ['new york m', 'new york mets', 'nym', 'nym mets', 'mets']),
  team('mlb', 'yankees', ['new york y', 'new york yankees', 'nyy', 'nyy yankees', 'yankees']),
  team('mlb', 'athletics', ['as', 'athletics', 'oakland athletics', 'oakland', 'ath']),
  team('mlb', 'phillies', ['philadelphia', 'philadelphia phillies', 'phi', 'phi phillies']),
  team('mlb', 'pirates', ['pittsburgh', 'pittsburgh pirates', 'pit', 'pit pirates']),
  team('mlb', 'padres', ['san diego', 'san diego padres', 'sd', 'sd padres']),
  team('mlb', 'giants', ['san francisco', 'san francisco giants', 'sf', 'sf giants']),
  team('mlb', 'mariners', ['seattle', 'seattle mariners', 'sea', 'sea mariners']),
  team('mlb', 'cardinals', ['st louis', 'saint louis', 'st louis cardinals', 'stl', 'stl cardinals']),
  team('mlb', 'rays', ['tampa bay', 'tampa bay rays', 'tb', 'tb rays']),
  team('mlb', 'rangers', ['texas', 'texas rangers', 'tex', 'tex rangers']),
  team('mlb', 'bluejays', ['toronto', 'toronto blue jays', 'tor', 'tor blue jays']),
  team('mlb', 'nationals', ['washington', 'washington nationals', 'wsh', 'was', 'wsh nationals']),

  // NFL
  team('nfl', 'cardinals', ['arizona', 'arizona cardinals', 'ari', 'ari cardinals']),
  team('nfl', 'falcons', ['atlanta', 'atlanta falcons', 'atl', 'atl falcons']),
  team('nfl', 'ravens', ['baltimore', 'baltimore ravens', 'bal', 'bal ravens']),
  team('nfl', 'bills', ['buffalo', 'buffalo bills', 'buf', 'buf bills']),
  team('nfl', 'panthers', ['carolina', 'carolina panthers', 'car', 'car panthers']),
  team('nfl', 'bears', ['chicago', 'chicago bears', 'chi', 'chi bears']),
  team('nfl', 'bengals', ['cincinnati', 'cincinnati bengals', 'cin', 'cin bengals']),
  team('nfl', 'browns', ['cleveland', 'cleveland browns', 'cle', 'cle browns']),
  team('nfl', 'cowboys', ['dallas', 'dallas cowboys', 'dal', 'dal cowboys']),
  team('nfl', 'broncos', ['denver', 'denver broncos', 'den', 'den broncos']),
  team('nfl', 'lions', ['detroit', 'detroit lions', 'det', 'det lions']),
  team('nfl', 'packers', ['green bay', 'green bay packers', 'gb', 'gb packers']),
  team('nfl', 'texans', ['houston', 'houston texans', 'hou', 'hou texans']),
  team('nfl', 'colts', ['indianapolis', 'indianapolis colts', 'ind', 'ind colts']),
  team('nfl', 'jaguars', ['jacksonville', 'jacksonville jaguars', 'jac', 'jax', 'jac jaguars']),
  team('nfl', 'chiefs', ['kansas city', 'kansas city chiefs', 'kc', 'kc chiefs']),
  team('nfl', 'chargers', ['los angeles c', 'la chargers', 'los angeles chargers', 'lac', 'lac chargers']),
  team('nfl', 'rams', ['los angeles r', 'la rams', 'los angeles rams', 'lar', 'lar rams']),
  team('nfl', 'raiders', ['las vegas', 'las vegas raiders', 'lv', 'lv raiders']),
  team('nfl', 'dolphins', ['miami', 'miami dolphins', 'mia', 'mia dolphins']),
  team('nfl', 'vikings', ['minnesota', 'minnesota vikings', 'min', 'min vikings']),
  team('nfl', 'patriots', ['new england', 'new england patriots', 'ne', 'ne patriots']),
  team('nfl', 'saints', ['new orleans', 'new orleans saints', 'no', 'no saints']),
  team('nfl', 'giants', ['new york g', 'ny giants', 'new york giants', 'nyg']),
  team('nfl', 'jets', ['new york j', 'ny jets', 'new york jets', 'nyj']),
  team('nfl', 'eagles', ['philadelphia', 'philadelphia eagles', 'phi', 'phi eagles']),
  team('nfl', 'steelers', ['pittsburgh', 'pittsburgh steelers', 'pit', 'pit steelers']),
  team('nfl', 'seahawks', ['seattle', 'seattle seahawks', 'sea', 'sea seahawks']),
  team('nfl', '49ers', ['san francisco', 'san francisco 49ers', 'sf', 'sf 49ers']),
  team('nfl', 'buccaneers', ['tampa bay', 'tampa bay buccaneers', 'tb', 'tb buccaneers']),
  team('nfl', 'titans', ['tennessee', 'tennessee titans', 'ten', 'ten titans']),
  team('nfl', 'commanders', ['washington', 'washington commanders', 'was', 'wsh', 'was commanders']),

  // NBA
  team('nba', 'celtics', ['boston', 'boston celtics', 'bos']),
  team('nba', 'nets', ['brooklyn', 'brooklyn nets', 'bkn']),
  team('nba', 'knicks', ['new york', 'new york knicks', 'ny', 'ny knicks']),
  team('nba', '76ers', ['philadelphia', 'philadelphia 76ers', 'phi', 'phi 76ers', 'sixers']),
  team('nba', 'raptors', ['toronto', 'toronto raptors', 'tor']),
  team('nba', 'bulls', ['chicago', 'chicago bulls', 'chi']),
  team('nba', 'cavaliers', ['cleveland', 'cleveland cavaliers', 'cle']),
  team('nba', 'pistons', ['detroit', 'detroit pistons', 'det']),
  team('nba', 'pacers', ['indiana', 'indiana pacers', 'ind']),
  team('nba', 'bucks', ['milwaukee', 'milwaukee bucks', 'mil']),
  team('nba', 'hawks', ['atlanta', 'atlanta hawks', 'atl']),
  team('nba', 'hornets', ['charlotte', 'charlotte hornets', 'cha']),
  team('nba', 'heat', ['miami', 'miami heat', 'mia']),
  team('nba', 'magic', ['orlando', 'orlando magic', 'orl']),
  team('nba', 'wizards', ['washington', 'washington wizards', 'was']),
  team('nba', 'nuggets', ['denver', 'denver nuggets', 'den']),
  team('nba', 'timberwolves', ['minnesota', 'minnesota timberwolves', 'min']),
  team('nba', 'thunder', ['oklahoma city', 'oklahoma city thunder', 'okc']),
  team('nba', 'blazers', ['portland', 'portland trail blazers', 'por']),
  team('nba', 'jazz', ['utah', 'utah jazz', 'uta']),
  team('nba', 'warriors', ['golden state', 'golden state warriors', 'gsw']),
  team('nba', 'clippers', ['los angeles c', 'la clippers', 'los angeles clippers', 'lac']),
  team('nba', 'lakers', ['los angeles l', 'la lakers', 'los angeles lakers', 'lal']),
  team('nba', 'suns', ['phoenix', 'phoenix suns', 'phx']),
  team('nba', 'kings', ['sacramento', 'sacramento kings', 'sac']),
  team('nba', 'mavericks', ['dallas', 'dallas mavericks', 'dal']),
  team('nba', 'rockets', ['houston', 'houston rockets', 'hou']),
  team('nba', 'grizzlies', ['memphis', 'memphis grizzlies', 'mem']),
  team('nba', 'pelicans', ['new orleans', 'new orleans pelicans', 'nop']),
  team('nba', 'spurs', ['san antonio', 'san antonio spurs', 'sa', 'sas']),

  // NHL
  team('nhl', 'ducks', ['anaheim', 'anaheim ducks']),
  team('nhl', 'bruins', ['boston', 'boston bruins', 'bruins']),
  team('nhl', 'sabres', ['buffalo', 'buffalo sabres', 'sabres']),
  team('nhl', 'flames', ['calgary', 'calgary flames', 'flames']),
  team('nhl', 'hurricanes', ['carolina', 'carolina hurricanes', 'hurricanes']),
  team('nhl', 'blackhawks', ['chicago', 'chicago blackhawks', 'blackhawks']),
  team('nhl', 'avalanche', ['colorado', 'colorado avalanche', 'avalanche']),
  team('nhl', 'bluejackets', ['columbus', 'columbus blue jackets', 'blue jackets']),
  team('nhl', 'stars', ['dallas', 'dallas stars', 'stars']),
  team('nhl', 'redwings', ['detroit', 'detroit red wings', 'red wings']),
  team('nhl', 'oilers', ['edmonton', 'edmonton oilers', 'oilers']),
  team('nhl', 'panthers', ['florida', 'florida panthers', 'panthers']),
  team('nhl', 'kings', ['los angeles', 'los angeles kings', 'kings']),
  team('nhl', 'wild', ['minnesota', 'minnesota wild', 'wild']),
  team('nhl', 'canadiens', ['montreal', 'montreal canadiens', 'canadiens']),
  team('nhl', 'predators', ['nashville', 'nashville predators', 'predators']),
  team('nhl', 'devils', ['new jersey', 'new jersey devils', 'devils']),
  team('nhl', 'islanders', ['new york i', 'ny islanders', 'new york islanders', 'islanders']),
  team('nhl', 'rangers', ['new york r', 'ny rangers', 'new york rangers']),
  team('nhl', 'senators', ['ottawa', 'ottawa senators', 'senators']),
  team('nhl', 'flyers', ['philadelphia', 'philadelphia flyers', 'flyers']),
  team('nhl', 'penguins', ['pittsburgh', 'pittsburgh penguins', 'penguins']),
  team('nhl', 'sharks', ['san jose', 'san jose sharks', 'sharks']),
  team('nhl', 'kraken', ['seattle', 'seattle kraken', 'kraken']),
  team('nhl', 'blues', ['st louis', 'st louis blues', 'blues']),
  team('nhl', 'lightning', ['tampa bay', 'tampa bay lightning', 'lightning']),
  team('nhl', 'mapleleafs', ['toronto', 'toronto maple leafs', 'maple leafs']),
  team('nhl', 'utah', ['utah', 'utah hockey club', 'utah mammoth', 'mammoth']),
  team('nhl', 'canucks', ['vancouver', 'vancouver canucks', 'canucks']),
  team('nhl', 'goldenknights', ['vegas', 'las vegas', 'vegas golden knights', 'golden knights']),
  team('nhl', 'capitals', ['washington', 'washington capitals', 'capitals']),
  team('nhl', 'jets', ['winnipeg', 'winnipeg jets']),

  // WNBA
  team('wnba', 'dream', ['atlanta', 'atlanta dream']),
  team('wnba', 'sky', ['chicago', 'chicago sky']),
  team('wnba', 'sun', ['connecticut', 'connecticut sun']),
  team('wnba', 'wings', ['dallas', 'dallas wings']),
  team('wnba', 'fever', ['indiana', 'indiana fever']),
  team('wnba', 'aces', ['las vegas', 'las vegas aces']),
  team('wnba', 'sparks', ['los angeles', 'los angeles sparks']),
  team('wnba', 'lynx', ['minnesota', 'minnesota lynx']),
  team('wnba', 'liberty', ['new york', 'new york liberty']),
  team('wnba', 'mercury', ['phoenix', 'phoenix mercury']),
  team('wnba', 'storm', ['seattle', 'seattle storm']),
  team('wnba', 'mystics', ['washington', 'washington mystics']),
  team('wnba', 'valkyries', ['golden state', 'golden state valkyries'])
]

const INDEX = new Map()
for (const row of TEAMS) {
  for (const name of row.names) {
    const key = `${row.league}|${normAlias(name)}`
    if (INDEX.has(key) && INDEX.get(key) !== row.id) INDEX.set(key, null)
    else if (!INDEX.has(key)) INDEX.set(key, row.id)
  }
}

export function leagueFamily(league, sport) {
  const text = `${league || ''} ${sport || ''}`.toLowerCase()
  if (/ebasket|esoccer|e-sport|esport|h2h gg/.test(text)) return 'esports'
  if (/\bwnba\b/.test(text)) return 'wnba'
  if (/\bnba\b/.test(text)) return 'nba'
  if (/\bnhl\b|hockey/.test(text)) return 'nhl'
  if (/\bmlb\b|baseball/.test(text)) return 'mlb'
  if (/\bnfl\b|american[_\s-]?football/.test(text)) return 'nfl'
  if (/soccer|mls|\bepl\b/.test(text)) return 'soccer'
  if (/ncaaf|college football/.test(text)) return 'ncaaf'
  if (/ncaab|college basketball/.test(text)) return 'ncaab'
  if (/basketball/.test(text)) return 'nba'
  return ''
}

export function resolveTeam(rawName, family) {
  if (!family) return null
  const name = normAlias(cleanTeamName(rawName))
  if (!name) return null
  return INDEX.get(`${family}|${name}`) || null
}

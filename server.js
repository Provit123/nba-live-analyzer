import express from 'express'
import { fileURLToPath } from 'url'
import path from 'path'

const app = express()
const PORT = 3000
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const NBA_CDN = 'https://cdn.nba.com/static/json'

// ============ 数据格式转换 ============

// 转换球员数据：NBA CDN格式 → 前端期望格式
function transformPlayer(p) {
  const s = p.statistics || {}
  return {
    personId: p.personId,
    name: p.name || p.nameI,
    firstName: p.firstName,
    familyName: p.familyName,
    jerseyNum: p.jerseyNum,
    position: p.position,
    starter: p.starter,
    oncourt: p.oncourt,
    played: p.played,
    // 前端期望的简写字段
    pts: s.points || 0,
    reb: s.reboundsTotal || 0,
    ast: s.assists || 0,
    blk: s.blocks || 0,
    stl: s.steals || 0,
    turnovers: s.turnovers || 0,
    min: s.minutesCalculated || s.minutes || '0',
    // 命中率
    fgPct: s.fieldGoalsPercentage || 0,
    fgMade: s.fieldGoalsMade || 0,
    fgAttempted: s.fieldGoalsAttempted || 0,
    threePct: s.threePointersPercentage || 0,
    threeMade: s.threePointersMade || 0,
    threeAttempted: s.threePointersAttempted || 0,
    ftPct: s.freeThrowsPercentage || 0,
    ftMade: s.freeThrowsMade || 0,
    ftAttempted: s.freeThrowsAttempted || 0,
    plusMinus: s.plusMinusPoints || 0,
  }
}

// 转换球队统计数据
function transformTeamStats(s) {
  if (!s) return null
  return {
    // 前端期望的简写字段
    reb: s.reboundsTotal || 0,
    ast: s.assists || 0,
    blk: s.blocks || 0,
    stl: s.steals || 0,
    turnovers: s.turnoversTotal || 0,
    fgPct: s.fieldGoalsPercentage || 0,
    threePtPct: s.threePointersPercentage || 0,
    // 额外有用的数据
    points: s.points || 0,
    pointsFastBreak: s.pointsFastBreak || 0,
    pointsInThePaint: s.pointsInThePaint || 0,
    pointsSecondChance: s.pointsSecondChance || 0,
    biggestLead: s.biggestLead || 0,
    benchPoints: s.benchPoints || 0,
  }
}

// 转换球队数据（包含球员和统计）
function transformTeam(team) {
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    teamCity: team.teamCity,
    teamTricode: team.teamTricode,
    score: team.score,
    inBonus: team.inBonus,
    timeoutsRemaining: team.timeoutsRemaining,
    periods: team.periods,
    players: (team.players || []).map(transformPlayer),
    statistics: transformTeamStats(team.statistics),
  }
}

// 解析NBA时钟格式为可读字符串
function parseClock(clock) {
  if (!clock) return ''
  const m = clock.match(/PT?(\d+)M([\d.]+)S/)
  if (m) return `${m[1]}:${parseInt(m[2]).toString().padStart(2, '0')}`
  return clock  // fallback
}

// 转换比赛记分板数据
function transformScoreboardGame(g) {
  return {
    gameId: g.gameId,
    gameCode: g.gameCode,
    gameStatus: g.gameStatus,
    gameStatusText: g.gameStatusText,
    gameClock: parseClock(g.gameClock),
    period: g.period,
    gameTimeLocal: g.gameTimeLocal || '',
    homeTeam: {
      teamId: g.homeTeam.teamId,
      teamCity: g.homeTeam.teamCity,
      teamName: g.homeTeam.teamName,
      teamTricode: g.homeTeam.teamTricode,
      score: g.homeTeam.score,
      wins: g.homeTeam.wins,
      losses: g.homeTeam.losses,
      seriesLead: g.homeTeam.seriesLead,
    },
    awayTeam: {
      teamId: g.awayTeam.teamId,
      teamCity: g.awayTeam.teamCity,
      teamName: g.awayTeam.teamName,
      teamTricode: g.awayTeam.teamTricode,
      score: g.awayTeam.score,
      wins: g.awayTeam.wins,
      losses: g.awayTeam.losses,
      seriesLead: g.awayTeam.seriesLead,
    },
  }
}

// ============ 代理请求 ============

async function nbaFetch(urlPath) {
  const url = `${NBA_CDN}${urlPath}`
  const start = Date.now()
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  console.log(`[PROXY] ${urlPath} (${Date.now() - start}ms)`)
  return data
}

// ============ API路由 ============

app.get('/api/scoreboard', async (req, res) => {
  try {
    const data = await nbaFetch('/liveData/scoreboard/todaysScoreboard_00.json')
    const scoreboard = data.scoreboard
    scoreboard.games = (scoreboard.games || []).map(transformScoreboardGame)
    res.json(scoreboard)
  } catch (e) {
    console.error('[SCOREBOARD ERROR]', e.message)
    res.status(502).json({ error: 'Failed to fetch scoreboard', detail: e.message })
  }
})

app.get('/api/boxscore/:gameId', async (req, res) => {
  try {
    const data = await nbaFetch(`/liveData/boxscore/boxscore_${req.params.gameId}.json`)
    const game = data.game
    game.homeTeam = transformTeam(game.homeTeam)
    game.awayTeam = transformTeam(game.awayTeam)
    res.json(game)
  } catch (e) {
    console.error('[BOXSCORE ERROR]', e.message)
    res.status(502).json({ error: 'Failed to fetch boxscore', detail: e.message })
  }
})

app.get('/api/pbp/:gameId', async (req, res) => {
  try {
    const data = await nbaFetch(`/liveData/playbyplay/playbyplay_${req.params.gameId}.json`)
    res.json(data.game)
  } catch (e) {
    console.error('[PBP ERROR]', e.message)
    res.status(502).json({ error: 'Failed to fetch play-by-play', detail: e.message })
  }
})

// 静态文件
app.use(express.static(path.join(__dirname, 'dist')))

// SPA fallback
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'))
})

app.listen(PORT, () => {
  console.log(`🏀 NBA Server running at http://localhost:${PORT}`)
})

import axios from 'axios'

// CORS代理 + NBA CDN 直连（无需后端服务器）
const CORS_PROXY = 'https://api.codetabs.com/v1/proxy?quest='
const NBA_CDN = 'https://cdn.nba.com/static/json'

// 优先用本地代理（开发模式），否则用CORS代理（生产/APK模式）
function getBaseUrl() {
  // 如果Vite dev server代理可用，优先用
  if (import.meta.env.DEV) {
    return '/api'
  }
  // 生产模式：通过CORS代理直连NBA CDN
  return `${CORS_PROXY}${encodeURIComponent(NBA_CDN)}`
}

const apiClient = axios.create({
  timeout: 15000,
})

// ============ 数据格式转换 ============

function parseClock(clock) {
  if (!clock) return ''
  const m = clock.match(/PT?(\d+)M([\d.]+)S/)
  if (m) return `${m[1]}:${parseInt(m[2]).toString().padStart(2, '0')}`
  return clock
}

function transformPlayer(p) {
  const s = p.statistics || {}
  return {
    personId: p.personId, name: p.name || p.nameI, firstName: p.firstName,
    familyName: p.familyName, jerseyNum: p.jerseyNum, position: p.position,
    starter: p.starter, oncourt: p.oncourt, played: p.played,
    pts: s.points || 0, reb: s.reboundsTotal || 0, ast: s.assists || 0,
    blk: s.blocks || 0, stl: s.steals || 0, turnovers: s.turnovers || 0,
    min: s.minutesCalculated || s.minutes || '0',
    fgPct: s.fieldGoalsPercentage || 0, fgMade: s.fieldGoalsMade || 0,
    fgAttempted: s.fieldGoalsAttempted || 0, threePct: s.threePointersPercentage || 0,
    threeMade: s.threePointersMade || 0, threeAttempted: s.threePointersAttempted || 0,
    ftPct: s.freeThrowsPercentage || 0, ftMade: s.freeThrowsMade || 0,
    ftAttempted: s.freeThrowsAttempted || 0, plusMinus: s.plusMinusPoints || 0,
  }
}

function transformTeamStats(s) {
  if (!s) return null
  return {
    reb: s.reboundsTotal || 0, ast: s.assists || 0, blk: s.blocks || 0,
    stl: s.steals || 0, turnovers: s.turnoversTotal || 0,
    fgPct: s.fieldGoalsPercentage || 0, threePtPct: s.threePointersPercentage || 0,
    points: s.points || 0, pointsFastBreak: s.pointsFastBreak || 0,
    pointsInThePaint: s.pointsInThePaint || 0, pointsSecondChance: s.pointsSecondChance || 0,
    biggestLead: s.biggestLead || 0, benchPoints: s.benchPoints || 0,
  }
}

function transformTeam(team) {
  return {
    teamId: team.teamId, teamName: team.teamName, teamCity: team.teamCity,
    teamTricode: team.teamTricode, score: team.score, inBonus: team.inBonus,
    timeoutsRemaining: team.timeoutsRemaining, periods: team.periods,
    players: (team.players || []).map(transformPlayer),
    statistics: transformTeamStats(team.statistics),
  }
}

function transformScoreboardGame(g) {
  return {
    gameId: g.gameId, gameCode: g.gameCode, gameStatus: g.gameStatus,
    gameStatusText: g.gameStatusText, gameClock: parseClock(g.gameClock),
    period: g.period, gameTimeLocal: g.gameTimeLocal || '',
    homeTeam: {
      teamId: g.homeTeam.teamId, teamCity: g.homeTeam.teamCity,
      teamName: g.homeTeam.teamName, teamTricode: g.homeTeam.teamTricode,
      score: g.homeTeam.score, wins: g.homeTeam.wins, losses: g.homeTeam.losses,
      seriesLead: g.homeTeam.seriesLead,
    },
    awayTeam: {
      teamId: g.awayTeam.teamId, teamCity: g.awayTeam.teamCity,
      teamName: g.awayTeam.teamName, teamTricode: g.awayTeam.teamTricode,
      score: g.awayTeam.score, wins: g.awayTeam.wins, losses: g.awayTeam.losses,
      seriesLead: g.awayTeam.seriesLead,
    },
  }
}

// ============ API方法 ============

export const nbaService = {
  // 获取今日比赛记分板
  async getLiveScoreboard() {
    try {
      if (import.meta.env.DEV) {
        const res = await apiClient.get('/api/scoreboard')
        return res.data
      }
      // CORS代理模式：直接请求NBA CDN
      const url = `${CORS_PROXY}${encodeURIComponent(NBA_CDN + '/liveData/scoreboard/todaysScoreboard_00.json')}`
      const res = await apiClient.get(url)
      const scoreboard = res.data.scoreboard
      scoreboard.games = (scoreboard.games || []).map(transformScoreboardGame)
      return scoreboard
    } catch (e) {
      console.error('获取记分板失败:', e)
      return null
    }
  },

  // 获取比赛详细数据(box score)
  async getBoxScore(gameId) {
    try {
      if (import.meta.env.DEV) {
        const res = await apiClient.get(`/api/boxscore/${gameId}`)
        return res.data
      }
      // CORS代理模式
      const url = `${CORS_PROXY}${encodeURIComponent(NBA_CDN + `/liveData/boxscore/boxscore_${gameId}.json`)}`
      const res = await apiClient.get(url)
      const game = res.data.game
      game.homeTeam = transformTeam(game.homeTeam)
      game.awayTeam = transformTeam(game.awayTeam)
      return game
    } catch (e) {
      console.error('获取比赛详情失败:', e)
      return null
    }
  },

  // 获取play-by-play数据
  async getPlayByPlay(gameId) {
    try {
      if (import.meta.env.DEV) {
        const res = await apiClient.get(`/api/pbp/${gameId}`)
        return res.data
      }
      // CORS代理模式
      const url = `${CORS_PROXY}${encodeURIComponent(NBA_CDN + `/liveData/playbyplay/playbyplay_${gameId}.json`)}`
      const res = await apiClient.get(url)
      return res.data.game
    } catch (e) {
      console.error('获取比赛进程失败:', e)
      return null
    }
  },

  // 格式化日期
  formatDate(date = new Date()) {
    return date.toISOString().split('T')[0]
  },

  // 获取节次文字
  getPeriodText(period) {
    if (!period) return '未开始'
    const p = parseInt(period)
    if (p <= 4) return `第${p}节`
    return `加时${p - 4}`
  }
}

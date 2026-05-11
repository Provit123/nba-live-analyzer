import axios from 'axios'

// CORS代理 + NBA CDN 直连（无需后端服务器）
const CORS_PROXY = 'https://api.codetabs.com/v1/proxy?quest='
const NBA_CDN = 'https://cdn.nba.com/static/json'

// 统一走CORS代理，无需本地后端
function cdnUrl(path) {
  return `${CORS_PROXY}${encodeURIComponent(NBA_CDN + path)}`
}

const apiClient = axios.create({
  timeout: 15000,
})

// ============ 数据格式转换 ============

// UTC时间转北京时间字符串
function toBeijingTime(utcStr) {
  if (!utcStr) return ''
  try {
    const d = new Date(utcStr)
    if (isNaN(d.getTime())) return utcStr
    // UTC+8 北京时间
    const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000)
    const month = bj.getUTCMonth() + 1
    const day = bj.getUTCDate()
    const hour = bj.getUTCHours().toString().padStart(2, '0')
    const min = bj.getUTCMinutes().toString().padStart(2, '0')
    return `${month}月${day}日 ${hour}:${min}`
  } catch {
    return utcStr
  }
}

// 北京时间日期字符串（用于历史分组）
function toBeijingDateStr(utcStr) {
  if (!utcStr) return ''
  try {
    const d = new Date(utcStr)
    if (isNaN(d.getTime())) return utcStr
    const bj = new Date(d.getTime() + 8 * 60 * 60 * 1000)
    return `${bj.getUTCFullYear()}-${(bj.getUTCMonth()+1).toString().padStart(2,'0')}-${bj.getUTCDate().toString().padStart(2,'0')}`
  } catch {
    return utcStr
  }
}

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
  // 北京时间转换
  const bjTime = g.gameTimeUTC ? toBeijingTime(g.gameTimeUTC) : ''
  return {
    gameId: g.gameId, gameCode: g.gameCode, gameStatus: g.gameStatus,
    gameStatusText: g.gameStatusText, gameClock: parseClock(g.gameClock),
    period: g.period, gameTimeLocal: bjTime,
    gameTimeUTC: g.gameTimeUTC || '',
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

// 从scheduleLeagueV2格式转换为统一格式
function transformScheduleGame(g) {
  const isFinished = g.gameStatus === 3
  // 北京时间转换
  const bjTime = g.gameDateTimeUTC ? toBeijingTime(g.gameDateTimeUTC) : ''
  return {
    gameId: g.gameId, gameCode: g.gameCode, gameStatus: g.gameStatus,
    gameStatusText: g.gameStatusText, gameClock: '',
    period: isFinished ? g.regulationPeriods || 4 : 0,
    gameTimeLocal: bjTime,
    gameTimeUTC: g.gameDateTimeUTC || '',
    gameLabel: g.gameLabel || '',
    seriesText: g.seriesText || '',
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
      const url = cdnUrl('/liveData/scoreboard/todaysScoreboard_00.json')
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
      const url = cdnUrl(`/liveData/boxscore/boxscore_${gameId}.json`)
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
      const url = cdnUrl(`/liveData/playbyplay/playbyplay_${gameId}.json`)
      const res = await apiClient.get(url)
      return res.data.game
    } catch (e) {
      console.error('获取比赛进程失败:', e)
      return null
    }
  },

  // 获取过去N天的比赛 + 未来M天的赛程
  async getRecentGames(days = 10, futureDays = 2) {
    try {
      const url = cdnUrl('/staticData/scheduleLeagueV2_1.json')
      const res = await apiClient.get(url, { timeout: 30000 })
      const gameDates = res.data.leagueSchedule.gameDates
      
      const now = new Date()
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      const futureCutoff = new Date(now.getTime() + futureDays * 24 * 60 * 60 * 1000)
      
      // 收集所有比赛并按北京时间日期分组
      const allGames = []
      for (const dateGroup of gameDates) {
        for (const g of dateGroup.games) {
          if (g.gameStatus !== 3 && g.gameStatus !== 2 && g.gameStatus !== 1) continue
          // 用UTC时间算北京时间日期
          const bjDate = toBeijingDateStr(g.gameDateTimeUTC)
          const gameDate = new Date(g.gameDateTimeUTC)
          if (gameDate < cutoff) continue
          if (gameDate > futureCutoff) continue // 超过未来M天不算
          const game = transformScheduleGame(g)
          // 标记未来比赛
          if (gameDate > now) {
            game.isUpcoming = true
          }
          allGames.push({ bjDate, game })
        }
      }
      
      // 按北京时间日期分组
      const grouped = {}
      for (const item of allGames) {
        if (!grouped[item.bjDate]) {
          grouped[item.bjDate] = []
        }
        grouped[item.bjDate].push(item.game)
      }
      
      // 转为数组，按日期倒序
      const result = Object.entries(grouped)
        .map(([date, games]) => ({ date, games }))
        .sort((a, b) => b.date.localeCompare(a.date))
      
      return result
    } catch (e) {
      console.error('获取历史比赛失败:', e)
      return []
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

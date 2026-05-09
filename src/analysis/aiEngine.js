/**
 * NBA AI Analysis Engine
 * 深度AI分析模块 - 包含多种统计分析模型
 */

// 解析NBA时钟格式 (PT02M05.00S 或 00:00)
function parseGameClock(clock) {
  if (!clock) return 0
  const ptMatch = clock.match(/PT?(\d+)M([\d.]+)S/)
  if (ptMatch) return parseInt(ptMatch[1]) * 60 + parseInt(ptMatch[2])
  const parts = clock.split(':').map(Number)
  return (parts[0] || 0) * 60 + (parts[1] || 0)
}

export class NBAIEngine {
  constructor() {
    // 模型参数 (基于NBA统计数据的经验值)
    this.params = {
      homeAdvantage: 2.5,  // 主场胜率加成 (分)
      momentumWeight: 0.15,  // 势头权重
      clutchWeight: 0.20,  // 关键球权重
      fatigueFactor: 0.02,  // 疲劳因子 (每加时赛)
    }
  }

  /**
   * 计算胜率模型 - 基于Logistic Regression
   * @param {number} scoreDiff - 分差 (主队-客队)
   * @param {number} timeRemaining - 剩余时间(秒)
   * @param {boolean} isHome - 是否主场
   * @param {number} period - 当前节次
   * @returns {number} 胜率 (0-1)
   */
  calculateWinProbability(scoreDiff, timeRemaining, isHome = false, period = 4) {
    // 标准化时间 (将剩余时间转换为"相当于第4节的倍数")
    const timeFactor = timeRemaining / (12 * 60) // 12分钟一节
    
    // 基础分差 (考虑时间因素)
    const adjustedDiff = scoreDiff * Math.sqrt(timeFactor + 0.5)
    
    // 主场加成
    const homeBonus = isHome ? this.params.homeAdvantage : 0
    
    // Logistic function
    const z = (adjustedDiff + homeBonus) / 6
    const winProb = 1 / (1 + Math.exp(-z))
    
    return Math.round(winProb * 100) / 100
  }

  /**
   * 势头分析 - 检测得分高潮/低谷
   * @param {Array} plays - play-by-play数据
   * @returns {Object} 势头分析结果
   */
  analyzeMomentum(plays) {
    if (!plays || plays.length === 0) {
      return { momentum: 0, runs: [], trend: 'neutral' }
    }
    
    const momentum = []
    let homeRun = 0
    let awayRun = 0
    const runs = []
    let currentRun = { team: null, points: 0, startTime: null }
    
    // 简化分析：取最近10个得分动作
    const recentPlays = plays.slice(-20)
    
    for (const play of recentPlays) {
      const team = play.teamAbbreviation
      const score = play.scoreAway || play.scoreHome
      
      if (score) {
        if (currentRun.team === team) {
          currentRun.points += parseInt(play.description.split(' - ')[0] || 0)
        } else {
          if (currentRun.points >= 8) {
            runs.push({ ...currentRun })
          }
          currentRun = { team, points: parseInt(play.description.split(' - ')[0] || 0), time: play.clock }
        }
      }
    }
    
    // 计算净势头
    const homeMomentum = runs.filter(r => r.team !== 'LAL').reduce((sum, r) => sum + r.points, 0)
    const awayMomentum = runs.filter(r => r.team === 'LAL').reduce((sum, r) => sum + r.points, 0)
    
    const netMomentum = homeMomentum - awayMomentum
    
    let trend = 'neutral'
    if (netMomentum > 6) trend = 'hot'
    else if (netMomentum < -6) trend = 'cold'
    
    return {
      momentum: netMomentum,
      runs: runs.slice(-3),
      trend,
      homeMomentum,
      awayMomentum
    }
  }

  /**
   * 计算球员效率评级 (PER简化版)
   * @param {Object} stats - 球员统计数据
   * @returns {number} 效率值
   */
  calculatePlayerEfficiency(stats) {
    if (!stats) return 0
    
    // 简化PER公式: (得分 + 篮板*1.2 + 助攻*1.5 + 抢断*2 + 封盖*2 - 失误) / 出场时间(分钟)
    // min可能是 "PT04M" 格式或数字
    let minutes = stats.min || 1
    if (typeof minutes === 'string') {
      const m = minutes.match(/PT(\d+)M/)
      minutes = m ? parseInt(m[1]) : 1
    }
    minutes = minutes || 1
    const pts = stats.pts || 0
    const reb = stats.reb || 0
    const ast = stats.ast || 0
    const stl = stats.stl || 0
    const blk = stats.blk || 0
    const to = stats.turnovers || stats.turnover || 0
    
    const efficiency = (pts + reb * 1.2 + ast * 1.5 + stl * 2 + blk * 2 - to) / (minutes / 48)
    
    return Math.round(efficiency * 10) / 10
  }

  /**
   * 关键球能力分析
   * @param {Object} game - 比赛数据
   * @returns {Object} 关键球分析
   */
  analyzeClutchPerformance(game) {
    // 简化：分析第4节关键时刻表现
    const homeTeam = game.homeTeam
    const awayTeam = game.awayTeam
    
    if (!homeTeam || !awayTeam) {
      return { homeClutch: 0, awayClutch: 0, keyPlayers: [] }
    }
    
    // 简化：取核心球员数据
    const homeKeyPlayers = (homeTeam.players || []).slice(0, 3)
    const awayKeyPlayers = (awayTeam.players || []).slice(0, 3)
    
    const homeClutch = homeKeyPlayers.reduce((sum, p) => sum + (p.pts || 0), 0) / 3
    const awayClutch = awayKeyPlayers.reduce((sum, p) => sum + (p.pts || 0), 0) / 3
    
    return {
      homeClutch: Math.round(homeClutch),
      awayClutch: Math.round(awayClutch),
      keyPlayers: [...homeKeyPlayers, ...awayKeyPlayers]
    }
  }

  /**
   * 预测最终比分 (蒙特卡洛简化版)
   * @param {Object} game - 当前比赛数据
   * @returns {Object} 预测结果
   */
  predictFinalScore(game) {
    const homeTeam = game.homeTeam
    const awayTeam = game.awayTeam
    
    if (!homeTeam || !awayTeam) return null
    
    const homeScore = parseInt(homeTeam.score || 0)
    const awayScore = parseInt(awayTeam.score || 0)
    const period = parseInt(game.period || 0)
    const clock = game.gameClock || ''
    const timeRemaining = parseGameClock(clock)
    
    // 简化预测：假设当前节奏持续到结束
    const totalMinutes = period <= 4 ? 48 : 48 + (period - 4) * 5
    const elapsedMinutes = period <= 4 ? period * 12 - timeRemaining / 60 : (period - 1) * 12 + (12 - timeRemaining / 60)
    
    if (elapsedMinutes < 1) return null
    
    // 预计得分率
    const pace = (homeScore + awayScore) / elapsedMinutes
    
    // 剩余时间得分预测
    const remainingPace = pace * (totalMinutes - elapsedMinutes)
    const homeRemain = Math.round(remainingPace * 0.48)
    const awayRemain = Math.round(remainingPace * 0.48)
    
    const predictedHome = homeScore + homeRemain
    const predictedAway = awayScore + awayRemain
    
    // 调整：考虑主场优势
    const homeAdvantage = this.params.homeAdvantage * (remainingPace / 48)
    
    return {
      home: Math.round(predictedHome + homeAdvantage),
      away: Math.round(predictedAway - homeAdvantage),
      confidence: Math.min(90, Math.round(50 + pace * 2))
    }
  }

  /**
   * 生成比赛洞察报告 (自然语言)
   * @param {Object} game - 比赛数据
   * @param {Object} analysis - 分析结果
   * @returns {Array} 洞察数组
   */
  generateInsights(game, analysis) {
    const insights = []
    const homeScore = parseInt(game.homeTeam?.score || 0)
    const awayScore = parseInt(game.awayTeam?.score || 0)
    const scoreDiff = homeScore - awayScore
    
    // 分差洞察
    if (scoreDiff > 10) {
      insights.push({
        type: 'dominant',
        icon: '🔥',
        title: '比赛已奠定基调',
        text: `${game.homeTeam?.teamName} 领先 ${scoreDiff} 分，大幅领先让胜利在望`
      })
    } else if (scoreDiff < -10) {
      insights.push({
        type: 'alert',
        icon: '⚠️',
        title: '落后方需发力',
        text: `${game.homeTeam?.teamName} 落后 ${Math.abs(scoreDiff)} 分，需要打出进攻高潮`
      })
    } else if (Math.abs(scoreDiff) < 5) {
      insights.push({
        type: 'close',
        icon: '⚔️',
        title: '势均力敌',
        text: '比赛进入关键时刻，双方都有机会'
      })
    }
    
    // 势头洞察
    if (analysis.momentum) {
      if (analysis.momentum.momentum > 4) {
        insights.push({
          type: 'momentum',
          icon: '🚀',
          title: '得分势头强劲',
          text: `${game.homeTeam?.teamName} 正在打出得分高潮，势头在他们这边`
        })
      } else if (analysis.momentum.momentum < -4) {
        insights.push({
          type: 'momentum',
          icon: '🛑',
          title: '客场起势',
          text: `${game.awayTeam?.teamName} 掌握比赛节奏`
        })
      }
    }
    
    // 预测洞察
    if (analysis.prediction) {
      const pred = analysis.prediction
      const winner = pred.home > pred.away ? game.homeTeam?.teamName : game.awayTeam?.teamName
      const margin = Math.abs(pred.home - pred.away)
      insights.push({
        type: 'prediction',
        icon: '🔮',
        title: 'AI预测',
        text: `预计 ${winner} 以 ${margin} 分左右获胜 (置信度 ${pred.confidence}%)`
      })
    }
    
    // 关键球员
    const homeKey = game.homeTeam?.players?.[0]
    const awayKey = game.awayTeam?.players?.[0]
    if (homeKey?.pts > 20) {
      insights.push({
        type: 'star',
        icon: '⭐',
        title: '核心球员',
        text: `${homeKey.name} 已经拿下 ${homeKey.pts} 分，表现亮眼`
      })
    }
    
    // 默认洞察
    if (insights.length < 2) {
      insights.push({
        type: 'info',
        icon: '📊',
        title: '数据观察',
        text: `比赛进行中，关注两队命中率变化`
      })
    }
    
    return insights
  }

  /**
   * 完整分析 - 返回所有分析结果
   * @param {Object} game - 比赛数据
   * @param {Array} plays - play-by-play数据
   * @returns {Object} 完整分析结果
   */
  fullAnalysis(game, plays = []) {
    const homeScore = parseInt(game.homeTeam?.score || 0)
    const awayScore = parseInt(game.awayTeam?.score || 0)
    const scoreDiff = homeScore - awayScore
    const clock = game.gameClock || ''
    const timeRemaining = parseGameClock(clock)
    const period = parseInt(game.period || 0)
    
    const winProb = this.calculateWinProbability(scoreDiff, timeRemaining, true, period)
    const momentum = this.analyzeMomentum(plays)
    const clutch = this.analyzeClutchPerformance(game)
    const prediction = this.predictFinalScore(game)
    
    return {
      winProbability: winProb,
      momentum,
      clutch,
      prediction,
      insights: this.generateInsights(game, { momentum, prediction })
    }
  }
}

export const aiEngine = new NBAIEngine()
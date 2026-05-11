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
   * 赛后总结分析 - 已结束比赛的分析报告
   * @param {Object} game - 比赛数据（含boxscore详情）
   * @returns {Object} 赛后总结
   */
  generatePostGameSummary(game) {
    const homeScore = parseInt(game.homeTeam?.score || 0)
    const awayScore = parseInt(game.awayTeam?.score || 0)
    const scoreDiff = Math.abs(homeScore - awayScore)
    const homeWon = homeScore > awayScore
    const winner = homeWon ? game.homeTeam : game.awayTeam
    const loser = homeWon ? game.awayTeam : game.homeTeam
    const winnerScore = Math.max(homeScore, awayScore)
    const loserScore = Math.min(homeScore, awayScore)
    
    // 比赛类型判断
    let gameType = '胶着比赛'
    if (scoreDiff >= 20) gameType = '一边倒'
    else if (scoreDiff >= 10) gameType = '掌控全局'
    else if (scoreDiff >= 5) gameType = '稳扎稳打'
    else gameType = '惊心动魄'
    
    // 找MVP - 得分最高的球员
    const allPlayers = [
      ...(game.homeTeam?.players || []),
      ...(game.awayTeam?.players || [])
    ].filter(p => p.pts > 0)
    
    const mvp = allPlayers.sort((a, b) => b.pts - a.pts)[0] || null
    
    // 找效率王 - 效率最高的球员（至少得10分）
    const efficiencyCandidates = allPlayers
      .filter(p => p.pts >= 10)
      .map(p => ({ ...p, efficiency: this.calculatePlayerEfficiency(p) }))
      .sort((a, b) => b.efficiency - a.efficiency)
    const efficiencyKing = efficiencyCandidates[0] || null
    
    // 找板凳匪徒 - 替补得分最高
    const benchPlayers = allPlayers
      .filter(p => p.starter === 'N' || p.starter === false)
      .sort((a, b) => b.pts - a.pts)
    const benchMvp = benchPlayers[0] || null
    
    // 球队数据对比分析
    const homeStats = game.homeTeam?.statistics
    const awayStats = game.awayTeam?.statistics
    const statAdvantages = []
    
    if (homeStats && awayStats) {
      const comparisons = [
        { key: 'reb', label: '篮板', home: homeStats.reb, away: awayStats.reb },
        { key: 'ast', label: '助攻', home: homeStats.ast, away: awayStats.ast },
        { key: 'blk', label: '封盖', home: homeStats.blk, away: awayStats.blk },
        { key: 'stl', label: '抢断', home: homeStats.stl, away: awayStats.stl },
        { key: 'turnovers', label: '失误', home: homeStats.turnovers, away: awayStats.turnovers, lower: true },
        { key: 'fgPct', label: '命中率', home: homeStats.fgPct, away: awayStats.fgPct },
        { key: 'threePtPct', label: '三分命中率', home: homeStats.threePtPct, away: awayStats.threePtPct },
      ]
      
      for (const c of comparisons) {
        const homeWins = c.lower ? c.home < c.away : c.home > c.away
        if (homeWins) {
          statAdvantages.push({ team: 'home', label: c.label, diff: Math.abs(c.home - c.away).toFixed(c.key.includes('Pct') ? 3 : 0) })
        } else if (c.home !== c.away) {
          statAdvantages.push({ team: 'away', label: c.label, diff: Math.abs(c.home - c.away).toFixed(c.key.includes('Pct') ? 3 : 0) })
        }
      }
    }
    
    // 关键因素洞察
    const keyFactors = []
    
    if (homeStats && awayStats) {
      // 命中率差异大
      if (Math.abs(homeStats.fgPct - awayStats.fgPct) > 0.05) {
        const better = homeStats.fgPct > awayStats.fgPct ? game.homeTeam : game.awayTeam
        keyFactors.push({
          icon: '🎯',
          title: '投篮效率制胜',
          text: `${better.teamCity}命中率${(Math.max(homeStats.fgPct, awayStats.fgPct) * 100).toFixed(1)}%，远超对手的${(Math.min(homeStats.fgPct, awayStats.fgPct) * 100).toFixed(1)}%`
        })
      }
      
      // 三分球差异
      if (Math.abs(homeStats.threePtPct - awayStats.threePtPct) > 0.08) {
        const better = homeStats.threePtPct > awayStats.threePtPct ? game.homeTeam : game.awayTeam
        keyFactors.push({
          icon: '🏹',
          title: '三分火力全开',
          text: `${better.teamCity}三分命中率${(Math.max(homeStats.threePtPct, awayStats.threePtPct) * 100).toFixed(1)}%，外线火力压制`
        })
      }
      
      // 篮板优势
      const rebDiff = Math.abs(homeStats.reb - awayStats.reb)
      if (rebDiff >= 8) {
        const better = homeStats.reb > awayStats.reb ? game.homeTeam : game.awayTeam
        keyFactors.push({
          icon: '💪',
          title: '篮板统治',
          text: `${better.teamCity}抢下${Math.max(homeStats.reb, awayStats.reb)}个篮板，多出${rebDiff}个，掌控了二次进攻机会`
        })
      }
      
      // 失误问题
      const toDiff = Math.abs(homeStats.turnovers - awayStats.turnovers)
      if (toDiff >= 5) {
        const worse = homeStats.turnovers > awayStats.turnovers ? game.homeTeam : game.awayTeam
        keyFactors.push({
          icon: '😅',
          title: '失误成灾',
          text: `${worse.teamCity}出现${Math.max(homeStats.turnovers, awayStats.turnovers)}次失误，给了对手太多轻松得分机会`
        })
      }
      
      // 板凳深度
      if (homeStats.benchPoints && awayStats.benchPoints) {
        const benchDiff = Math.abs(homeStats.benchPoints - awayStats.benchPoints)
        if (benchDiff >= 10) {
          const better = homeStats.benchPoints > awayStats.benchPoints ? game.homeTeam : game.awayTeam
          keyFactors.push({
            icon: '🔥',
            title: '板凳深度',
            text: `${better.teamCity}替补贡献${Math.max(homeStats.benchPoints, awayStats.benchPoints)}分，板凳深度成为胜负手`
          })
        }
      }
    }
    
    // 没有特别突出因素时的默认分析
    if (keyFactors.length === 0) {
      keyFactors.push({
        icon: '⚖️',
        title: '实力接近',
        text: '双方数据相差不大，胜负在细节之间'
      })
    }
    
    return {
      winner: { name: winner.teamCity + ' ' + winner.teamName, tricode: winner.teamTricode, score: winnerScore },
      loser: { name: loser.teamCity + ' ' + loser.teamName, tricode: loser.teamTricode, score: loserScore },
      scoreDiff,
      gameType,
      mvp: mvp ? { name: mvp.name, pts: mvp.pts, reb: mvp.reb, ast: mvp.ast, team: mvp.name && game.homeTeam?.players?.some(p => p.personId === mvp.personId) ? game.homeTeam.teamTricode : game.awayTeam?.teamTricode } : null,
      efficiencyKing: efficiencyKing ? { name: efficiencyKing.name, efficiency: efficiencyKing.efficiency, pts: efficiencyKing.pts } : null,
      benchMvp: benchMvp ? { name: benchMvp.name, pts: benchMvp.pts } : null,
      statAdvantages,
      keyFactors,
    }
  }

  /**
   * 赛前预测分析 - 基于战绩的主客队胜率预测
   * @param {Object} game - 比赛数据（含homeTeam/awayTeam的wins/losses）
   * @returns {Object} 赛前预测
   */
  generatePreGamePrediction(game) {
    const homeWins = parseInt(game.homeTeam?.wins || 0)
    const homeLosses = parseInt(game.homeTeam?.losses || 0)
    const awayWins = parseInt(game.awayTeam?.wins || 0)
    const awayLosses = parseInt(game.awayTeam?.losses || 0)
    const homeGames = homeWins + homeLosses
    const awayGames = awayWins + awayLosses
    
    // 判断是否是季后赛（系列赛模式）
    const isPlayoffs = game.gameLabel && (
      game.gameLabel.includes('Conf.') || 
      game.gameLabel.includes('Finals') || 
      game.gameLabel.includes('Playoff')
    )
    
    let homeWinProb
    
    if (isPlayoffs && homeGames > 0 && awayGames > 0) {
      // 季后赛：基于系列赛战绩+势头分析
      // 系列赛领先优势比胜率更重要
      const homeSeriesRate = homeWins / homeGames
      const awaySeriesRate = awayWins / awayGames
      
      // 系列赛势头：最近谁在赢（连胜越多势头越强）
      const homeMomentum = homeWins - homeLosses  // 正数=领先
      const awayMomentum = awayWins - awayLosses
      
      // 种子排名影响
      const homeSeed = parseInt(game.homeTeam?.seed || 99)
      const awaySeed = parseInt(game.awayTeam?.seed || 99)
      const seedBonus = (awaySeed - homeSeed) * 0.025  // 低种子(强队)加成
      
      // 主场优势
      const homeAdvantage = 0.08  // 季后赛主场优势更大
      
      // 淘汰赛压力：落后方的比赛压力
      let pressureBonus = 0
      if (homeLosses >= 3 && homeWins < 4) pressureBonus = -0.08  // 主队被淘汰边缘
      if (awayLosses >= 3 && awayWins < 4) pressureBonus = 0.08   // 客队被淘汰边缘
      
      // 综合计算
      const homePower = homeSeriesRate + homeAdvantage + seedBonus * 0.5 + pressureBonus + homeMomentum * 0.06
      const awayPower = awaySeriesRate - seedBonus * 0.5 - pressureBonus + awayMomentum * 0.06
      const total = homePower + awayPower
      homeWinProb = total > 0 ? homePower / total : 0.5
      
      // 避免极端值（15%-85%之间）
      homeWinProb = Math.max(0.15, Math.min(0.85, homeWinProb))
    } else if (homeGames > 0 && awayGames > 0) {
      // 常规赛：基于战绩
      const homeWinRate = homeWins / homeGames
      const awayWinRate = awayWins / awayGames
      const homeAdvantage = 0.06
      const homePower = homeWinRate + homeAdvantage
      const awayPower = awayWinRate
      const total = homePower + awayPower
      homeWinProb = total > 0 ? homePower / total : 0.5
    } else {
      // 没有战绩数据时，用种子排名估算
      const homeSeed = parseInt(game.homeTeam?.seed || 8)
      const awaySeed = parseInt(game.awayTeam?.seed || 8)
      const seedDiff = awaySeed - homeSeed
      homeWinProb = 0.5 + seedDiff * 0.04  // 种子差4=0.16优势
      homeWinProb = Math.max(0.25, Math.min(0.75, homeWinProb))
    }
    

    // 伤病影响调整胜率
    const _homeTricode = game.homeTeam?.teamTricode || ''
    const _awayTricode = game.awayTeam?.teamTricode || ''
    const _homeInj = (teamProfiles[_homeTricode]?.injured || [])
    const _awayInj = (teamProfiles[_awayTricode]?.injured || [])
    let injuryAdjust = 0
    _homeInj.forEach(p => { injuryAdjust -= (p.impact === 'high' ? 0.08 : p.impact === 'medium' ? 0.05 : 0.02) })
    _awayInj.forEach(p => { injuryAdjust += (p.impact === 'high' ? 0.08 : p.impact === 'medium' ? 0.05 : 0.02) })
    homeWinProb = homeWinProb + injuryAdjust
    homeWinProb = Math.max(0.10, Math.min(0.90, homeWinProb))
    // 伤病看点
    const injuryHighlights = []
    _homeInj.filter(p => p.impact === 'high').forEach(p => {
      injuryHighlights.push({ icon: '🏥', title: '主队核心伤缺', text: `${game.homeTeam?.teamCity || '主队'}${p.name}伤缺，进攻火力大幅下降！` })
    })
    _awayInj.filter(p => p.impact === 'high').forEach(p => {
      injuryHighlights.push({ icon: '🏥', title: '客队核心伤缺', text: `${game.awayTeam?.teamCity || '客队'}${p.name}伤缺，实力受损！` })
    })
    // 预测比分
    const avgPoints = isPlayoffs ? 105 : 110
    const homePredScore = Math.round(avgPoints + (homeWinProb - 0.5) * 20)
    const awayPredScore = Math.round(avgPoints + ((1 - homeWinProb) - 0.5) * 20 - 2)
    
    // 置信度
    const probDiff = Math.abs(homeWinProb - 0.5)
    const confidence = Math.min(80, Math.round(40 + probDiff * 120))
    
    // 关键看点
    const highlights = []
    
    if (isPlayoffs) {
      const homeSeed = parseInt(game.homeTeam?.seed || 99)
      const awaySeed = parseInt(game.awayTeam?.seed || 99)
      const totalGamesPlayed = homeWins + homeLosses
      
      if (totalGamesPlayed === 0) {
        highlights.push({
          icon: '🎬',
          title: '系列赛首战',
          text: `${game.homeTeam.teamCity}(#${homeSeed}) vs ${game.awayTeam.teamCity}(#${awaySeed})，系列赛拉开帷幕！`
        })
      } else {
        const leader = homeWins > awayWins ? game.homeTeam : (awayWins > homeWins ? game.awayTeam : null)
        const leadGames = Math.abs(homeWins - awayLosses)
        if (leader && Math.abs(homeWins - awayWins) >= 2) {
          highlights.push({
            icon: '🔥',
            title: '系列赛占优',
            text: `${leader.teamCity}系列赛${Math.max(homeWins, awayWins)}-${Math.min(homeLosses, awayLosses)}领先！`
          })
        } else if (Math.abs(homeWins - awayWins) <= 1) {
          highlights.push({
            icon: '⚔️',
            title: '系列赛胶着',
            text: `系列赛${Math.max(homeWins, awayWins)}-${Math.min(homeWins, awayWins)}，咬得很紧！`
          })
        }
      }
      
      if (homeLosses >= 3 && homeWins < 4) {
        highlights.push({ icon: '🚨', title: '背水一战', text: `${game.homeTeam.teamCity}系列赛${homeWins}-${homeLosses}落后，输球即淘汰！` })
      }
      if (awayLosses >= 3 && awayWins < 4) {
        highlights.push({ icon: '🚨', title: '淘汰压力', text: `${game.awayTeam.teamCity}系列赛${awayWins}-${awayLosses}落后，命悬一线！` })
      }
      
      if (Math.abs(parseInt(game.homeTeam?.seed || 8) - parseInt(game.awayTeam?.seed || 8)) >= 5) {
        const higher = parseInt(game.homeTeam?.seed || 8) < parseInt(game.awayTeam?.seed || 8) ? game.homeTeam : game.awayTeam
        highlights.push({ icon: '👑', title: '种子差距', text: `${higher.teamCity}排名占优，但季后赛一切皆有可能` })
      }
    } else if (homeGames > 0 && awayGames > 0) {
      const homeWinRate = homeWins / homeGames
      const awayWinRate = awayWins / awayGames
      const winRateDiff = Math.abs(homeWinRate - awayWinRate)
      
      if (homeWinRate > 0.6 && awayWinRate > 0.6) {
        highlights.push({ icon: '🔥', title: '强强对话', text: '双方战绩出色，火星撞地球！' })
      }
      if (winRateDiff > 0.2) {
        const better = homeWinRate > awayWinRate ? game.homeTeam : game.awayTeam
        highlights.push({ icon: '💪', title: '实力差距', text: `${better.teamCity}战绩明显占优` })
      }
      if (winRateDiff < 0.08 && homeGames > 5) {
        highlights.push({ icon: '⚔️', title: '势均力敌', text: '双方战绩接近，胜负难料' })
      }
    }
    
    if (highlights.length === 0) {
      highlights.push({
        icon: '📊',
        title: '赛前分析',
        text: `${game.homeTeam.teamCity} vs ${game.awayTeam.teamCity}，精彩对决即将上演`
      })
    }
    
    return {
      homeWinProb: Math.round(homeWinProb * 100) / 100,
      awayWinProb: Math.round((1 - homeWinProb) * 100) / 100,
      homePredScore: Math.max(homePredScore, 85),
      awayPredScore: Math.max(awayPredScore, 85),
      confidence,
      highlights: [...injuryHighlights, ...highlights],
      homeRecord: `${homeWins}-${homeLosses}`,
      awayRecord: `${awayWins}-${awayLosses}`,
    }
  }

  /**
   * 球员阵容分析 - 基于已知信息分析双方阵容特点
   * @param {Object} game - 比赛数据
   * @returns {Object} 阵容分析
   */
  analyzeRoster(game) {
    const homeCity = game.homeTeam?.teamCity || ''
    const awayCity = game.awayTeam?.teamTricode || ''
    const homeTricode = game.homeTeam?.teamTricode || ''
    const awayTricode = game.awayTeam?.teamTricode || ''
    const homeSeed = parseInt(game.homeTeam?.seed || 8)
    const awaySeed = parseInt(game.awayTeam?.seed || 8)

    // 基于种子排名推算球队风格
    const homeRankTier = homeSeed <= 4 ? 'top' : 'mid'
    const awayRankTier = awaySeed <= 4 ? 'top' : 'mid'

    // NBA球队核心球员与打法知识库
    const teamProfiles = {
      OKC: { stars: ['SGA(亚历山大)', 'Holmgren(霍姆格伦)', 'Jalen Williams(杰伦·威廉姆斯)'], style: '防守强队，SGA突破杀伤力顶级，内外线均衡' },
      CLE: { stars: ['Mitchell(米切尔)', 'Garland(加兰)', 'Mobley(莫布里)'], style: '攻防一体，双后卫驱动，莫布里护框能力强', injured: [{"name":"Garland(加兰)","impact":"medium"}] },
      BOS: { stars: ['Tatum(塔图姆)', 'Brown(布朗)', 'Porzingis(波尔津吉斯)'], style: '冠军底蕴，双核驱动，空间型阵容投射出色', injured: [{"name":"Brown(布朗)","impact":"high"}] },
      NYK: { stars: ['Brunson(布伦森)', 'Towns(唐斯)', 'Anunoby(阿努诺比)'], style: '布伦森持球核心，唐斯拉开空间，防守端有硬度' },
      DEN: { stars: ['Jokic(约基奇)', 'Murray(默里)', 'Gordon(戈登)'], style: '约基奇策应核心，高位传导体系，内线统治力强' },
      LAL: { stars: ['LeBron(詹姆斯)', 'Doncic(东契奇)', 'Reaves(里夫斯)'], style: '双星持球，詹姆斯组织+东契奇得分，转换进攻犀利' },
      MIN: { stars: ['Edwards(爱德华兹)', 'Gobert(戈贝尔)', 'Randle(兰德尔)'], style: '防守铁军，戈贝尔护框+爱德华兹突破，节奏偏慢' },
      IND: { stars: ['Haliburton(哈里伯顿)', 'Siakam(西亚卡姆)', 'Turner(特纳)'], style: '快节奏进攻，哈里伯顿组织，全场推进反击' },
      MIL: { stars: ['Giannis(字母哥)', 'Lillard(利拉德)', 'Middleton(米德尔顿)'], style: '字母哥冲击内线+利拉德外线火力，攻强守弱', injured: [{"name":"Lillard(利拉德)","impact":"high"}] },
      HOU: { stars: ['Sengun(申京)', 'Green(格林)', 'Brooks(布鲁克斯)'], style: '年轻天赋，防守端有硬度，进攻端尚不稳定' },
      GSW: { stars: ['Curry(库里)', 'Butler(巴特勒)', 'Green(追梦格林)'], style: '库里三分体系+巴特勒攻防一体，传切配合流畅' },
      DET: { stars: ['Cunningham(坎宁安)', 'Ivey(艾维)', 'Duren(杜伦)'], style: '年轻核心崛起，坎宁安组织能力出色，防守端有提升' },
      LAC: { stars: ['Harden(哈登)', 'Leonard(伦纳德)', 'Zubac(祖巴茨)'], style: '双核持球，伦纳德攻防一体，节奏偏慢磨阵地' },
      MEM: { stars: ['Morant(莫兰特)', 'Jackson Jr.(杰克逊)', 'Bane(贝恩)'], style: '莫兰特突破撕裂防线，3J护框，快节奏对攻' },
      ORL: { stars: ['Banchero(班凯罗)', 'Wagner(瓦格纳)', 'Suggs(萨格斯)'], style: '锋线双核，身体天赋出色，外线投射是短板' },
      ATL: { stars: ['Trae Young(特雷·杨)', 'Johnson(约翰逊)', 'Risacher(里萨谢)'], style: '特雷·杨持球核心，进攻火力猛但防守端漏洞大' },
      CHI: { stars: ['LaVine(拉文)', 'White(怀特)', 'Vučević(武切维奇)'], style: '拉文得分爆发力强，但整体攻防两端均缺乏稳定性' },
      TOR: { stars: ['Barnes(巴恩斯)', 'RJ Barrett(RJ巴雷特)', 'Quickley(奎克利)'], style: '重建期，巴恩斯全能但缺乏明星帮手' },
      BKN: { stars: ['Thomas(托马斯)', 'Johnson(卡梅隆·约翰逊)', 'Claxton(克拉克斯顿)'], style: '重建期，得分点分散，防守端有克拉克斯顿坐镇' },
      WAS: { stars: ['Poole(普尔)', 'Kuzma(库兹马)', 'Sarr(萨尔)'], style: '重建期，年轻天赋为主，攻防两端均不成熟' },
      CHA: { stars: ['Ball(三球)', 'Miller(米勒)', 'Williams(威廉姆斯)'], style: '三球组织串联，进攻节奏快，但防守端脆弱' },
      MIA: { stars: ['Adebayo(阿德巴约)', 'Herro(希罗)', 'Rozier(罗齐尔)'], style: '热火文化，防守纪律严明，关键时刻韧性十足' },
      SAS: { stars: ['Wembanyama(文班亚马)', 'Fox(福克斯)', 'Castle(卡斯尔)'], style: '文班亚马天赋异禀攻防一体，福克斯提速，潜力巨大' },
      NOP: { stars: ['Williamson(锡安)', 'Murphy(墨菲)', 'McCollum(麦科勒姆)'], style: '锡安内线碾压，但健康隐患大，外线投射不稳定' },
      SAC: { stars: ['Sabonis(萨博尼斯)', 'DeRozan(德罗赞)', 'LaVine(拉文)'], style: '小萨策应核心，德罗赞中距离，阵地战为主' },
      POR: { stars: ['Henderson(亨德森)', 'Simons(西蒙斯)', 'Ayton(艾顿)'], style: '重建期，年轻后卫为主，攻防两端缺乏体系' },
      UTA: { stars: ['Markkanen(马尔卡宁)', 'Sexton(塞克斯顿)', 'Clarkson(克拉克森)'], style: '马尔卡宁空间型内线，整体攻防不稳定' },
      PHI: { stars: ['Embiid(恩比德)', 'Maxey(马克西)', 'George(乔治)'], style: '三巨头但伤病频繁，恩比德内线统治力+马克西速度', injured: [{"name":"Embiid(恩比德)","impact":"high"}] },
      PHX: { stars: ['Booker(布克)', 'Durant(杜兰特)', 'Beal(比尔)'], style: '三巨头但缺乏组织者，单打依赖度高，防守端偏弱' },
      DAL: { stars: ['Irving(欧文)', 'Thompson(汤普森)', 'Davis(戴维斯)'], style: '欧文单打+浓眉内线，但阵容深度不足', injured: [{"name":"Irving(欧文)","impact":"high"}] },
    }

    const homeProfile = teamProfiles[homeTricode] || {
      stars: ['数据待更新'],
      injured: [],
      style: `${homeCity}队，种子排名#${homeSeed}` + (homeRankTier === 'top' ? '，上半区实力强队' : '，中游水平球队')
    }
    const awayProfile = teamProfiles[awayTricode] || {
      stars: ['数据待更新'],
      injured: [],
      style: `${game.awayTeam?.teamCity || ''}队，种子排名#${awaySeed}` + (awayRankTier === 'top' ? '，上半区实力强队' : '，中游水平球队')
    }

    // 阵容对位分析
    const matchupInsights = []

    if (homeRankTier === 'top' && awayRankTier === 'top') {
      matchupInsights.push({ icon: '🔥', title: '强强对话', text: '双方都是上半区球队，硬碰硬！' })
    }
    if (homeRankTier === 'top' && awayRankTier !== 'top') {
      matchupInsights.push({ icon: '💪', title: '实力占优', text: `${homeCity}作为上半区种子，整体阵容深度更胜一筹` })
    }
    if (awayRankTier === 'top' && homeRankTier !== 'top') {
      matchupInsights.push({ icon: '💪', title: '实力占优', text: `${game.awayTeam?.teamCity || ''}上半区种子排名，纸面实力更优` })
    }
    if (Math.abs(homeSeed - awaySeed) >= 5) {
      const higher = homeSeed < awaySeed ? homeCity : (game.awayTeam?.teamCity || '')
      matchupInsights.push({ icon: '📊', title: '排名悬殊', text: `种子差距${Math.abs(homeSeed - awaySeed)}位，${higher}排名优势明显` })
    }
    if (homeSeed <= 2 || awaySeed <= 2) {
      const topTeam = homeSeed <= 2 ? homeCity : (game.awayTeam?.teamCity || '')
      matchupInsights.push({ icon: '👑', title: '顶级种子', text: `${topTeam}是前2号种子，常规赛统治力极强` })
    }

    // 区分活跃球员和伤病球员
    const homeInjuredNames = (homeProfile.injured || []).map(p => p.name)
    const awayInjuredNames = (awayProfile.injured || []).map(p => p.name)
    const homeActiveStars = homeProfile.stars.filter(s => !homeInjuredNames.includes(s))
    const awayActiveStars = awayProfile.stars.filter(s => !awayInjuredNames.includes(s))

    // 伤病影响洞察
    const homeInjuredHigh = (homeProfile.injured || []).filter(p => p.impact === 'high')
    const awayInjuredHigh = (awayProfile.injured || []).filter(p => p.impact === 'high')
    if (homeInjuredHigh.length > 0) {
      matchupInsights.push({ icon: '🏥', title: '主队伤病', text: `${homeCity}核心球员伤缺：${homeInjuredHigh.map(p=>p.name).join('、')}，实力受损！` })
    }
    if (awayInjuredHigh.length > 0) {
      matchupInsights.push({ icon: '🏥', title: '客队伤病', text: `${game.awayTeam?.teamCity || ''}核心球员伤缺：${awayInjuredHigh.map(p=>p.name).join('、')}，实力受损！` })
    }

    return {
      home: {
        city: homeCity,
        stars: homeProfile.stars,
        activeStars: homeActiveStars,
        injuredStars: homeProfile.injured || [],
        style: homeProfile.style,
      },
      away: {
        city: game.awayTeam?.teamCity || '',
        stars: awayProfile.stars,
        activeStars: awayActiveStars,
        injuredStars: awayProfile.injured || [],
        style: awayProfile.style,
      },
      matchupInsights,
    }
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
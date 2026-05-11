<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <h1 class="header-title">🏀 NBA实时分析</h1>
      <div class="header-status">
        <span class="live-dot" v-if="hasLiveGames"></span>
        <span class="header-time">{{ currentTime }}</span>
      </div>
    </header>

    <!-- Tab Navigation -->
    <nav class="tab-nav">
      <button 
        :class="['tab-btn', activeTab === 'games' && 'active']" 
        @click="activeTab = 'games'">
        🏀 今日
      </button>
      <button 
        :class="['tab-btn', activeTab === 'history' && 'active']" 
        @click="activeTab = 'history'; loadHistory()">
        📅 历史
      </button>
      <button 
        :class="['tab-btn', activeTab === 'detail' && 'active']" 
        @click="activeTab = 'detail'"
        :disabled="!selectedGame">
        📊 详情
      </button>
      <button 
        :class="['tab-btn', activeTab === 'analysis' && 'active']" 
        @click="activeTab = 'analysis'"
        :disabled="!selectedGame">
        🧠 分析
      </button>
    </nav>

    <!-- Loading -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>正在加载比赛数据...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error">
      <p>❌ {{ error }}</p>
      <button class="retry-btn" @click="loadData">重试</button>
    </div>

    <!-- History Tab -->
    <div v-else-if="activeTab === 'history'" class="tab-content">
      <div v-if="historyLoading" class="loading">
        <div class="spinner"></div>
        <p>正在加载历史比赛...</p>
      </div>
      <div v-else-if="historyGames.length === 0" class="empty">
        <p>📭 暂无历史比赛数据</p>
      </div>
      <div v-else class="history-list">
        <div v-for="dayGroup in historyGames" :key="dayGroup.date" class="history-day">
          <div class="day-header">📅 {{ formatHistoryDate(dayGroup.date) }}</div>
          <div 
            v-for="game in dayGroup.games" 
            :key="game.gameId"
            :class="['game-card', selectedGame?.gameId === game.gameId && 'selected', isFinished(game) && 'finished', game.isUpcoming && 'upcoming']"
            @click="selectGame(game)">
            <div class="game-status-bar">
              <span :class="['status-badge', isFinished(game) ? 'finished' : game.isUpcoming ? 'upcoming' : '']">
                {{ game.isUpcoming ? '📅' : '' }} {{ getHistoryStatusText(game) }}
              </span>
              <span v-if="game.gameLabel" class="game-label-tag">{{ game.gameLabel }}</span>
              <span v-if="game.isUpcoming" class="predict-tag">🧠 预测</span>
            </div>
            <div class="game-teams">
              <div class="team-row">
                <span class="team-city">{{ game.homeTeam.teamCity }}</span>
                <span class="team-name">{{ game.homeTeam.teamName }}</span>
                <span :class="['team-score', isFinished(game) && parseInt(game.homeTeam.score) > parseInt(game.awayTeam.score) && 'winner']">
                  {{ game.homeTeam.score || 0 }}
                </span>
              </div>
              <div class="team-row">
                <span class="team-city">{{ game.awayTeam.teamCity }}</span>
                <span class="team-name">{{ game.awayTeam.teamName }}</span>
                <span :class="['team-score', isFinished(game) && parseInt(game.awayTeam.score) > parseInt(game.homeTeam.score) && 'winner']">
                  {{ game.awayTeam.score || 0 }}
                </span>
              </div>
            </div>
            <div v-if="game.seriesText" class="series-text">{{ game.seriesText }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Games Tab -->
    <div v-else-if="activeTab === 'games'" class="tab-content">
      <div v-if="games.length === 0" class="empty">
        <p>📭 今天没有比赛</p>
        <p class="empty-sub">比赛日通常是北京时间早上开始</p>
      </div>
      <div v-else class="game-list">
        <div 
          v-for="game in games" 
          :key="game.gameId"
          :class="['game-card', selectedGame?.gameId === game.gameId && 'selected', isLive(game) && 'live']"
          @click="selectGame(game)">
          <div class="game-status-bar">
            <span :class="['status-badge', isLive(game) ? 'live' : '']">
              {{ getStatusText(game) }}
            </span>
          </div>
          <div class="game-teams">
            <div class="team-row">
              <span class="team-city">{{ game.homeTeam.teamCity }}</span>
              <span class="team-name">{{ game.homeTeam.teamName }}</span>
              <span class="team-score">{{ game.homeTeam.score || 0 }}</span>
            </div>
            <div class="team-row">
              <span class="team-city">{{ game.awayTeam.teamCity }}</span>
              <span class="team-name">{{ game.awayTeam.teamName }}</span>
              <span class="team-score">{{ game.awayTeam.score || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail Tab -->
    <div v-else-if="activeTab === 'detail' && selectedGame" class="tab-content">
      <!-- 未来比赛：赛前预测概览 -->
      <template v-if="selectedGame.isUpcoming && preGamePrediction">
        <div class="scoreboard upcoming-scoreboard">
          <div class="sb-team sb-home">
            <div class="sb-team-info">
              <span class="sb-city">{{ selectedGame.homeTeam.teamCity }}</span>
              <span class="sb-name">{{ selectedGame.homeTeam.teamName }}</span>
            </div>
            <div class="sb-record">{{ preGamePrediction.homeRecord }}</div>
          </div>
          <div class="sb-center">
            <div class="sb-period upcoming-label">VS</div>
            <div class="sb-clock upcoming-time">{{ selectedGame.gameTimeLocal }}</div>
          </div>
          <div class="sb-team sb-away">
            <div class="sb-team-info">
              <span class="sb-city">{{ selectedGame.awayTeam.teamCity }}</span>
              <span class="sb-name">{{ selectedGame.awayTeam.teamName }}</span>
            </div>
            <div class="sb-record">{{ preGamePrediction.awayRecord }}</div>
          </div>
        </div>

        <!-- 胜率预测 -->
        <div class="analysis-card">
          <h3 class="section-title">🎯 胜率预测</h3>
          <div class="win-prob-container">
            <div class="win-prob-team">
              <span class="wp-city">{{ selectedGame.homeTeam.teamCity }}</span>
              <span class="wp-pct">{{ Math.round(preGamePrediction.homeWinProb * 100) }}%</span>
            </div>
            <div class="win-prob-bar">
              <div 
                class="wp-bar-home" 
                :style="{ width: Math.round(preGamePrediction.homeWinProb * 100) + '%' }">
              </div>
            </div>
            <div class="win-prob-team">
              <span class="wp-city">{{ selectedGame.awayTeam.teamCity }}</span>
              <span class="wp-pct">{{ Math.round(preGamePrediction.awayWinProb * 100) }}%</span>
            </div>
          </div>
        </div>

        <!-- 比分预测 -->
        <div class="analysis-card">
          <h3 class="section-title">🔮 比分预测</h3>
          <div class="prediction">
            <div class="pred-team">
              <span class="pred-city">{{ selectedGame.homeTeam.teamCity }}</span>
              <span class="pred-score">{{ preGamePrediction.homePredScore }}</span>
            </div>
            <span class="pred-vs">VS</span>
            <div class="pred-team">
              <span class="pred-city">{{ selectedGame.awayTeam.teamCity }}</span>
              <span class="pred-score">{{ preGamePrediction.awayPredScore }}</span>
            </div>
          </div>
          <div class="pred-confidence">置信度: {{ preGamePrediction.confidence }}%</div>
        </div>

        <!-- 关键看点 -->
        <div class="analysis-card">
          <h3 class="section-title">👀 关键看点</h3>
          <div class="insights-list">
            <div v-for="(item, i) in preGamePrediction.highlights" :key="i" class="insight-item">
              <div class="insight-icon">{{ item.icon }}</div>
              <div class="insight-content">
                <h4>{{ item.title }}</h4>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 已结束/进行中比赛 -->
      <template v-else>
      <div class="scoreboard">
        <div class="sb-team sb-home">
          <div class="sb-team-info">
            <span class="sb-city">{{ selectedGame.homeTeam.teamCity }}</span>
            <span class="sb-name">{{ selectedGame.homeTeam.teamName }}</span>
          </div>
          <div class="sb-score">{{ selectedGame.homeTeam.score || 0 }}</div>
        </div>
        <div class="sb-center">
          <div class="sb-period">{{ getPeriodText(selectedGame) }}</div>
          <div class="sb-clock">{{ formatClock(selectedGame.gameClock) }}</div>
        </div>
        <div class="sb-team sb-away">
          <div class="sb-team-info">
            <span class="sb-city">{{ selectedGame.awayTeam.teamCity }}</span>
            <span class="sb-name">{{ selectedGame.awayTeam.teamName }}</span>
          </div>
          <div class="sb-score">{{ selectedGame.awayTeam.score || 0 }}</div>
        </div>
      </div>

      <!-- Team Stats Comparison -->
      <div class="stats-section">
        <h3 class="section-title">📊 球队数据对比</h3>
        <div class="stat-compare" v-if="homeStats && awayStats">
          <div class="stat-row" v-for="stat in teamStatKeys" :key="stat.key">
            <span class="stat-val" :class="{ highlight: homeStats[stat.key] > awayStats[stat.key] }">
              {{ formatStat(homeStats[stat.key], stat) }}
            </span>
            <div class="stat-bar-container">
              <span class="stat-label">{{ stat.label }}</span>
              <div class="stat-bar">
                <div class="stat-bar-home" :style="{ width: getBarWidth(homeStats[stat.key], awayStats[stat.key]) + '%' }"></div>
                <div class="stat-bar-away" :style="{ width: getBarWidth(awayStats[stat.key], homeStats[stat.key]) + '%' }"></div>
              </div>
            </div>
            <span class="stat-val" :class="{ highlight: awayStats[stat.key] > homeStats[stat.key] }">
              {{ formatStat(awayStats[stat.key], stat) }}
            </span>
          </div>
        </div>
        <div v-else class="stat-placeholder">加载球队数据中...</div>
      </div>

      <!-- Player Stats -->
      <div class="stats-section" v-if="boxScore">
        <h3 class="section-title">👤 球员数据</h3>
        <div class="player-tabs">
          <button 
            :class="['player-tab-btn', playerTab === 'home' && 'active']"
            @click="playerTab = 'home'">
            {{ selectedGame.homeTeam.teamCity }}
          </button>
          <button 
            :class="['player-tab-btn', playerTab === 'away' && 'active']"
            @click="playerTab = 'away'">
            {{ selectedGame.awayTeam.teamCity }}
          </button>
        </div>
        <div class="player-table">
          <div class="player-table-header">
            <span class="pt-name">球员</span>
            <span class="pt-stat">得分</span>
            <span class="pt-stat">篮板</span>
            <span class="pt-stat">助攻</span>
            <span class="pt-stat">封盖</span>
            <span class="pt-stat">失误</span>
            <span class="pt-stat">效率</span>
          </div>
          <div 
            v-for="player in currentTeamPlayers" 
            :key="player.personId"
            class="player-table-row">
            <span class="pt-name">{{ player.name }}</span>
            <span class="pt-stat">{{ player.pts || 0 }}</span>
            <span class="pt-stat">{{ player.reb || 0 }}</span>
            <span class="pt-stat">{{ player.ast || 0 }}</span>
            <span class="pt-stat">{{ player.blk || 0 }}</span>
            <span class="pt-stat">{{ player.turnovers || 0 }}</span>
            <span class="pt-stat efficiency">{{ getPlayerEfficiency(player) }}</span>
          </div>
        </div>
      </div>
      </template>
    </div>

    <!-- Analysis Tab -->
    <div v-else-if="activeTab === 'analysis' && selectedGame" class="tab-content">
      <!-- 未来比赛：赛前深度分析 -->
      <template v-if="selectedGame.isUpcoming && preGamePrediction">
        <!-- 战绩对比 -->
        <div class="analysis-card">
          <h3 class="section-title">📊 战绩对比</h3>
          <div class="record-compare">
            <div class="record-team">
              <span class="record-city">{{ selectedGame.homeTeam.teamCity }}</span>
              <span class="record-val">{{ preGamePrediction.homeRecord }}</span>
              <span class="record-label">主场</span>
            </div>
            <div class="record-vs">VS</div>
            <div class="record-team">
              <span class="record-city">{{ selectedGame.awayTeam.teamCity }}</span>
              <span class="record-val">{{ preGamePrediction.awayRecord }}</span>
              <span class="record-label">客场</span>
            </div>
          </div>
        </div>

        <!-- 球员阵容 -->
        <div class="analysis-card" v-if="rosterAnalysis">
          <h3 class="section-title">👤 球员阵容</h3>
          <div class="roster-section">
            <div class="roster-team">
              <h4 class="roster-team-name">{{ rosterAnalysis.home.city }}</h4>
              <div class="roster-stars">
                <span v-for="(star, i) in rosterAnalysis.home.activeStars" :key="'a'+i" class="roster-star">⭐ {{ star }}</span>
                <span v-for="(star, i) in rosterAnalysis.home.injuredStars" :key="'i'+i" class="roster-star injured-star">🏥 {{ star.name }}</span>
              </div>
            </div>
            <div class="roster-divider">VS</div>
            <div class="roster-team">
              <h4 class="roster-team-name">{{ rosterAnalysis.away.city }}</h4>
              <div class="roster-stars">
                <span v-for="(star, i) in rosterAnalysis.away.activeStars" :key="'a'+i" class="roster-star">⭐ {{ star }}</span>
                <span v-for="(star, i) in rosterAnalysis.away.injuredStars" :key="'i'+i" class="roster-star injured-star">🏥 {{ star.name }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 球队打法 -->
        <div class="analysis-card" v-if="rosterAnalysis">
          <h3 class="section-title">🏀 球队打法</h3>
          <div class="style-section">
            <div class="style-team">
              <h4 class="style-team-name">{{ rosterAnalysis.home.city }}</h4>
              <p class="style-desc">{{ rosterAnalysis.home.style }}</p>
            </div>
            <div class="style-team">
              <h4 class="style-team-name">{{ rosterAnalysis.away.city }}</h4>
              <p class="style-desc">{{ rosterAnalysis.away.style }}</p>
            </div>
          </div>
        </div>

        <!-- 对位看点 -->
        <div class="analysis-card" v-if="rosterAnalysis && rosterAnalysis.matchupInsights.length > 0">
          <h3 class="section-title">⚔️ 对位看点</h3>
          <div class="insights-list">
            <div v-for="(item, i) in rosterAnalysis.matchupInsights" :key="i" class="insight-item">
              <div class="insight-icon">{{ item.icon }}</div>
              <div class="insight-content">
                <h4>{{ item.title }}</h4>
                <p>{{ item.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 已结束比赛：赛后总结 -->
      <template v-if="isFinished(selectedGame) && postGameSummary">
        <div class="analysis-card summary-header">
          <div class="summary-result">
            <span class="summary-winner">🏆 {{ postGameSummary.winner.name }}</span>
            <span class="summary-score">
              {{ postGameSummary.winner.score }} - {{ postGameSummary.loser.score }}
            </span>
          </div>
          <div class="summary-type">{{ postGameSummary.gameType }}</div>
          <div v-if="postGameSummary.scoreDiff <= 3" class="summary-close">⚠️ 险胜！仅差{{ postGameSummary.scoreDiff }}分</div>
        </div>

        <!-- MVP -->
        <div class="analysis-card" v-if="postGameSummary.mvp">
          <h3 class="section-title">⭐ 全场最佳</h3>
          <div class="mvp-display">
            <div class="mvp-name">{{ postGameSummary.mvp.name }}</div>
            <div class="mvp-stats">
              <span class="mvp-stat">{{ postGameSummary.mvp.pts }}分</span>
              <span class="mvp-stat">{{ postGameSummary.mvp.reb }}板</span>
              <span class="mvp-stat">{{ postGameSummary.mvp.ast }}助</span>
            </div>
          </div>
        </div>

        <!-- 效率王 -->
        <div class="analysis-card" v-if="postGameSummary.efficiencyKing">
          <h3 class="section-title">📈 效率之王</h3>
          <div class="mvp-display">
            <div class="mvp-name">{{ postGameSummary.efficiencyKing.name }}</div>
            <div class="mvp-stats">
              <span class="mvp-stat">效率值 {{ postGameSummary.efficiencyKing.efficiency }}</span>
              <span class="mvp-stat">{{ postGameSummary.efficiencyKing.pts }}分</span>
            </div>
          </div>
        </div>

        <!-- 板凳匪徒 -->
        <div class="analysis-card" v-if="postGameSummary.benchMvp">
          <h3 class="section-title">🔥 板凳匪徒</h3>
          <div class="mvp-display">
            <div class="mvp-name">{{ postGameSummary.benchMvp.name }}</div>
            <div class="mvp-stats">
              <span class="mvp-stat">替补 {{ postGameSummary.benchMvp.pts }}分</span>
            </div>
          </div>
        </div>

        <!-- 关键因素 -->
        <div class="analysis-card">
          <h3 class="section-title">🔑 胜负关键</h3>
          <div class="insights-list">
            <div v-for="(factor, i) in postGameSummary.keyFactors" :key="i" class="insight-item">
              <div class="insight-icon">{{ factor.icon }}</div>
              <div class="insight-content">
                <h4>{{ factor.title }}</h4>
                <p>{{ factor.text }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 数据优势对比 -->
        <div class="analysis-card" v-if="postGameSummary.statAdvantages.length > 0">
          <h3 class="section-title">📊 数据优势分布</h3>
          <div class="advantage-grid">
            <div 
              v-for="adv in postGameSummary.statAdvantages" 
              :key="adv.label"
              :class="['advantage-item', adv.team === 'home' ? 'adv-home' : 'adv-away']">
              <span class="adv-label">{{ adv.label }}</span>
              <span class="adv-team">{{ adv.team === 'home' ? selectedGame.homeTeam.teamTricode : selectedGame.awayTeam.teamTricode }}</span>
            </div>
          </div>
        </div>
      </template>

      <!-- 进行中/未开始比赛：比分预测 -->
      <template v-else>
      <!-- Predicted Score -->
      <div class="analysis-card" v-if="analysis.prediction">
        <h3 class="section-title">🔮 最终比分预测</h3>
        <div class="prediction">
          <div class="pred-team">
            <span class="pred-city">{{ selectedGame.homeTeam.teamCity }}</span>
            <span class="pred-score">{{ analysis.prediction.home }}</span>
          </div>
          <span class="pred-vs">VS</span>
          <div class="pred-team">
            <span class="pred-city">{{ selectedGame.awayTeam.teamCity }}</span>
            <span class="pred-score">{{ analysis.prediction.away }}</span>
          </div>
        </div>
        <div class="pred-confidence">置信度: {{ analysis.prediction.confidence }}%</div>
      </div>
      </template>
    </div>

    <!-- Refresh indicator -->
    <div class="refresh-bar" v-if="hasLiveGames">
      <span>🔄 {{ refreshCountdown }}秒后刷新</span>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { nbaService } from './services/nbaService.js'
import { aiEngine } from './analysis/aiEngine.js'

export default {
  name: 'App',
  setup() {
    const loading = ref(true)
    const error = ref(null)
    const games = ref([])
    const selectedGame = ref(null)
    const boxScore = ref(null)
    const activeTab = ref('games')
    const playerTab = ref('home')
    const analysis = ref({ winProbability: null, momentum: null, prediction: null, insights: [] })
    const postGameSummary = ref(null)
    const preGamePrediction = ref(null)
    const rosterAnalysis = ref(null)
    const historyGames = ref([])
    const historyLoading = ref(false)
    const currentTime = ref('')
    const refreshCountdown = ref(30)
    const refreshTimer = ref(null)
    const clockTimer = ref(null)

    const teamStatKeys = [
      { key: 'reb', label: '篮板' },
      { key: 'ast', label: '助攻' },
      { key: 'blk', label: '封盖' },
      { key: 'stl', label: '抢断' },
      { key: 'turnovers', label: '失误' },
      { key: 'fgPct', label: '命中率%', isPct: true },
      { key: 'threePtPct', label: '三分%', isPct: true },
    ]

    function formatStat(val, stat) {
      if (val == null) return 0
      if (stat.isPct) return (val * 100).toFixed(1)
      return val
    }

    const hasLiveGames = computed(() => games.value.some(g => {
      const s = g.gameStatus
      return s === '1' || s === '2' || s === 1 || s === 2
    }))

    const homeStats = computed(() => {
      if (!boxScore.value?.homeTeam?.statistics) return null
      return boxScore.value.homeTeam.statistics
    })

    const awayStats = computed(() => {
      if (!boxScore.value?.awayTeam?.statistics) return null
      return boxScore.value.awayTeam.statistics
    })

    const currentTeamPlayers = computed(() => {
      if (!boxScore.value) return []
      const team = playerTab.value === 'home' ? boxScore.value.homeTeam : boxScore.value.awayTeam
      return (team?.players || [])
        .filter(p => p.pts || p.reb || p.ast || p.blk)
        .sort((a, b) => (b.pts || 0) - (a.pts || 0))
    })

    function isLive(game) {
      const s = game.gameStatus
      return s === '1' || s === '2' || s === 1 || s === 2
    }

    function getStatusText(game) {
      if (game.gameStatus === '3' || game.gameStatus === 3) return '🏁 已结束'
      if (game.gameStatus === '2' || game.gameStatus === 2) return '🏀 ' + (game.gameStatusText || '进行中')
      if (game.gameStatus === '1' || game.gameStatus === 1) return '🏀 ' + (game.gameStatusText || '进行中')
      // 未开始：显示北京时间
      if (game.gameTimeLocal) return '📅 ' + game.gameTimeLocal
      return '📅 ' + (game.gameStatusText || '待定')
    }

    function getPeriodText(game) {
      const status = game.gameStatus
      if (status === '3' || status === 3) return '已结束'
      if (status !== '2' && status !== 2) return '未开始'
      const period = parseInt(game.period || 0)
      if (period === 0) return '未开始'
      if (period <= 4) return `第${period}节`
      return `加时${period - 4}`
    }

    function formatClock(clock) {
      if (!clock) return ''
      // 已经从server转换过了 (如 "2:05")，直接返回
      return clock
    }

    function getBarWidth(val1, val2) {
      const total = parseFloat(val1 || 0) + parseFloat(val2 || 0)
      if (total === 0) return 50
      return Math.round((parseFloat(val1 || 0) / total) * 100)
    }

    function getPlayerEfficiency(player) {
      return aiEngine.calculatePlayerEfficiency({
        pts: player.pts,
        reb: player.reb,
        ast: player.ast,
        stl: player.steals,
        blk: player.blk,
        turnover: player.turnovers,
        min: player.minutes
      })
    }

    async function loadData() {
      loading.value = true
      error.value = null
      try {
        const scoreboard = await nbaService.getLiveScoreboard()
        if (scoreboard) {
          games.value = scoreboard.games || []
        } else {
          // Fallback: try balldontlie
          const today = nbaService.formatDate()
          const bdlGames = await nbaService.getGamesByDate(today)
          games.value = bdlGames.map(g => ({
            gameId: g.id.toString(),
            gameStatus: g.status === 'Final' ? '3' : g.status === 'In Progress' ? '2' : '1',
            gameClock: g.time || '',
            period: g.period || 0,
            homeTeam: { 
              teamCity: g.home_team?.city || '', 
              teamName: g.home_team?.name || '', 
              score: g.home_team_score || 0 
            },
            awayTeam: { 
              teamCity: g.visitor_team?.city || '', 
              teamName: g.visitor_team?.name || '', 
              score: g.visitor_team_score || 0 
            },
          }))
        }
        
        // Auto-select first live game
        const liveGame = games.value.find(g => isLive(g))
        if (liveGame) selectGame(liveGame)
      } catch (e) {
        error.value = '无法连接NBA数据源，请检查网络连接'
        console.error(e)
      }
      loading.value = false
    }

    function isFinished(game) {
      const s = game.gameStatus
      return s === '3' || s === 3
    }

    function getHistoryStatusText(game) {
      if (game.isUpcoming) return game.gameTimeLocal || '即将开赛'
      if (isFinished(game)) return '已结束'
      if (isLive(game)) return game.gameStatusText || '进行中'
      return game.gameStatusText || game.gameTimeLocal || '待定'
    }

    function formatHistoryDate(dateStr) {
      // dateStr format: "2026-05-11" (已经是北京时间日期)
      const parts = dateStr.split('-')
      const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]))
      const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      return `${parseInt(parts[1])}月${parseInt(parts[2])}日 ${weekdays[d.getDay()]}`
    }

    async function loadHistory() {
      if (historyGames.value.length > 0) return // 已加载过就跳过
      historyLoading.value = true
      try {
        const schedule = await nbaService.getRecentGames(10)
        if (schedule && schedule.length > 0) {
          historyGames.value = schedule
        }
      } catch (e) {
        console.error('加载历史比赛失败:', e)
      }
      historyLoading.value = false
    }

    async function selectGame(game) {
      selectedGame.value = game
      activeTab.value = 'detail'
      boxScore.value = null
      postGameSummary.value = null
      preGamePrediction.value = null
      rosterAnalysis.value = null
      
      // 未来比赛：赛前预测
      if (game.isUpcoming) {
        preGamePrediction.value = aiEngine.generatePreGamePrediction(game)
        rosterAnalysis.value = aiEngine.analyzeRoster(game)
        analysis.value = { winProbability: null, momentum: null, prediction: null, insights: [] }
        return
      }
      
      // Load box score
      try {
        const bs = await nbaService.getBoxScore(game.gameId)
        if (bs) {
          boxScore.value = bs
        }
      } catch (e) {
        console.error('Failed to load box score:', e)
      }
      
      // 已结束比赛：生成赛后总结
      if (isFinished(game)) {
        const gameForAnalysis = {
          ...game,
          homeTeam: {
            ...game.homeTeam,
            players: boxScore.value?.homeTeam?.players || [],
            statistics: boxScore.value?.homeTeam?.statistics || null
          },
          awayTeam: {
            ...game.awayTeam,
            players: boxScore.value?.awayTeam?.players || [],
            statistics: boxScore.value?.awayTeam?.statistics || null
          }
        }
        postGameSummary.value = aiEngine.generatePostGameSummary(gameForAnalysis)
        analysis.value = { winProbability: null, momentum: null, prediction: null, insights: [] }
      } else {
        // 进行中/未开始：运行AI预测分析
        runAnalysis()
      }
    }

    function runAnalysis() {
      if (!selectedGame.value) return
      analysis.value = aiEngine.fullAnalysis(selectedGame.value, [])
    }

    function updateClock() {
      const now = new Date()
      currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Hong_Kong' })
    }

    function startAutoRefresh() {
      refreshTimer.value = setInterval(async () => {
        refreshCountdown.value--
        if (refreshCountdown.value <= 0) {
          refreshCountdown.value = 30
          await loadData()
          if (selectedGame.value) {
            try {
              const bs = await nbaService.getBoxScore(selectedGame.value.gameId)
              if (bs) boxScore.value = bs
              runAnalysis()
            } catch (e) { /* ignore */ }
          }
        }
      }, 1000)
    }

    onMounted(() => {
      updateClock()
      clockTimer.value = setInterval(updateClock, 30000)
      loadData()
      startAutoRefresh()
    })

    onUnmounted(() => {
      if (refreshTimer.value) clearInterval(refreshTimer.value)
      if (clockTimer.value) clearInterval(clockTimer.value)
    })

    return {
      loading, error, games, selectedGame, boxScore, activeTab, playerTab,
      analysis, postGameSummary, preGamePrediction, rosterAnalysis, historyGames, historyLoading,
      currentTime, refreshCountdown,
      hasLiveGames, homeStats, awayStats, currentTeamPlayers,
      isLive, isFinished, getStatusText, getHistoryStatusText, getPeriodText, formatClock, formatHistoryDate,
      getBarWidth, getPlayerEfficiency, formatStat,
      loadData, selectGame, loadHistory, teamStatKeys
    }
  }
}
</script>

<style>
:root {
  --bg: #f5f6fa;
  --card: #ffffff;
  --card-hover: #f0f1f5;
  --accent: #ff6b35;
  --accent2: #1a73e8;
  --danger: #e53935;
  --success: #43a047;
  --text: #1a1a2e;
  --muted: #8a8fa0;
  --border: #e8eaf0;
  --home: #ff6b35;
  --away: #1a73e8;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: 'Inter', -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.app {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 60px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #ffffff 0%, #f0f1f5 100%);
  border-bottom: 1px solid var(--border);
}

.header-title {
  font-size: 20px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--accent), var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: var(--accent);
}

.header-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.header-time {
  color: var(--muted);
  font-size: 13px;
}

/* Tab Navigation */
.tab-nav {
  display: flex;
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 0 8px;
}

.tab-btn {
  flex: 1;
  padding: 12px 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
}

.tab-btn.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Loading & Error */
.loading, .error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin { to { transform: rotate(360deg); } }

.retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-weight: 600;
}

/* Game List */
.tab-content {
  padding: 12px 16px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--muted);
}

.empty-sub { font-size: 13px; margin-top: 8px; opacity: 0.7; }

.game-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-card {
  background: var(--card);
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all 0.2s;
}

.game-card:hover { background: var(--card-hover); }
.game-card.selected { border-color: var(--accent); background: var(--card-hover); }
.game-card.live { border-left: 3px solid var(--danger); }

.game-status-bar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 8px;
}

.status-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}

.status-badge.live {
  color: var(--danger);
}

.team-row {
  display: flex;
  align-items: center;
  padding: 4px 0;
}

.team-city {
  font-size: 12px;
  color: var(--muted);
  width: 60px;
}

.team-name {
  flex: 1;
  font-weight: 600;
  font-size: 15px;
}

.team-score {
  font-size: 20px;
  font-weight: 800;
  min-width: 40px;
  text-align: right;
}

/* Scoreboard */
.scoreboard {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #f8f9fc, #ffffff);
  border-radius: 16px;
  padding: 20px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
}

.sb-team {
  flex: 1;
  text-align: center;
}

.sb-team-info {
  display: flex;
  flex-direction: column;
}

.sb-city { font-size: 11px; color: var(--muted); }
.sb-name { font-size: 14px; font-weight: 700; }
.sb-score { font-size: 36px; font-weight: 900; margin-top: 4px; }

.sb-home .sb-score { color: var(--home); }
.sb-away .sb-score { color: var(--away); }

.sb-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 12px;
}

.sb-period { font-size: 13px; color: var(--accent); font-weight: 700; }
.sb-clock { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; }

/* Stats Section */
.stats-section {
  background: var(--card);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
}

.section-title {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 12px;
}

.stat-compare {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-val {
  width: 36px;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
}

.stat-val.highlight { color: var(--accent); }

.stat-bar-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
}

.stat-bar {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border);
  display: flex;
  overflow: hidden;
}

.stat-bar-home {
  height: 100%;
  background: var(--home);
  border-radius: 3px 0 0 3px;
}

.stat-bar-away {
  height: 100%;
  background: var(--away);
  border-radius: 0 3px 3px 0;
}

/* Player Tabs */
.player-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.player-tab-btn {
  flex: 1;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.player-tab-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

/* Player Table */
.player-table {
  font-size: 12px;
}

.player-table-header {
  display: flex;
  padding: 8px 4px;
  border-bottom: 1px solid var(--border);
  color: var(--muted);
  font-weight: 600;
}

.player-table-row {
  display: flex;
  padding: 8px 4px;
  border-bottom: 1px solid rgba(232,234,240,0.5);
}

.player-table-row:hover { background: var(--card-hover); }

.pt-name { flex: 2; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pt-stat { flex: 1; text-align: center; }
.pt-stat.efficiency { color: var(--accent); font-weight: 700; }

/* Analysis Cards */
.analysis-card {
  background: var(--card);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--border);
}

/* Win Probability */
.win-prob-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.win-prob-team {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.wp-city { font-size: 13px; color: var(--muted); }
.wp-pct { font-size: 18px; font-weight: 800; }

.win-prob-bar {
  width: 100%;
  height: 10px;
  background: var(--away);
  border-radius: 5px;
  overflow: hidden;
}

.wp-bar-home {
  height: 100%;
  background: var(--home);
  border-radius: 5px;
  transition: width 0.5s ease;
}

/* Prediction */
.prediction {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 0;
}

.pred-team { text-align: center; }
.pred-city { display: block; font-size: 12px; color: var(--muted); }
.pred-score { font-size: 28px; font-weight: 900; }
.pred-vs { font-size: 14px; color: var(--muted); font-weight: 700; }

.pred-confidence {
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  margin-top: 8px;
}

/* Momentum */
.momentum-display {
  padding: 8px 0;
}

.momentum-meter {
  width: 100%;
  height: 8px;
  background: var(--away);
  border-radius: 4px;
  overflow: hidden;
}

.momentum-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.momentum-bar.hot { background: var(--home); }
.momentum-bar.cold { background: var(--away); }
.momentum-bar.neutral { background: linear-gradient(90deg, var(--home), var(--away)); }

.momentum-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

.momentum-desc {
  margin-top: 8px;
  font-size: 14px;
  text-align: center;
}

/* Insights */
.insights-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.insight-item {
  display: flex;
  gap: 12px;
  padding: 10px;
  background: rgba(0,0,0,0.03);
  border-radius: 10px;
}

.insight-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.insight-content h4 {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
}

.insight-content p {
  font-size: 13px;
  color: var(--muted);
  line-height: 1.5;
}

.injured-star {
  text-decoration: line-through;
  opacity: 0.5;
  color: #e74c3c;
  font-size: 0.85em;
}

.insight-empty {
  text-align: center;
  color: var(--muted);
  padding: 20px;
  font-size: 14px;
}

/* Roster Section */
.roster-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.roster-team {
  flex: 1;
}
.roster-team-name {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 8px;
  color: var(--home);
}
.roster-team:last-child .roster-team-name {
  color: var(--away);
}
.roster-stars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.roster-star {
  font-size: 13px;
  color: var(--text);
  line-height: 1.4;
}
.roster-divider {
  font-weight: 900;
  color: var(--muted);
  font-size: 16px;
  padding-top: 4px;
}

/* Style Section */
.style-section {
  display: flex;
  gap: 12px;
}
.style-team {
  flex: 1;
}
.style-team-name {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--home);
}
.style-team:last-child .style-team-name {
  color: var(--away);
}
.style-desc {
  font-size: 13px;
  color: var(--text);
  line-height: 1.6;
  background: var(--bg);
  padding: 10px 12px;
  border-radius: 8px;
}

.stat-placeholder {
  text-align: center;
  color: var(--muted);
  padding: 20px;
}

/* Refresh Bar */
.refresh-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--card);
  border-top: 1px solid var(--border);
  padding: 8px;
  text-align: center;
  font-size: 12px;
  color: var(--muted);
  z-index: 100;
}

/* Post-Game Summary */
.summary-header {
  text-align: center;
}

.summary-result {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-winner {
  font-size: 20px;
  font-weight: 800;
  color: var(--accent);
}

.summary-score {
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 2px;
}

.summary-type {
  font-size: 14px;
  color: var(--muted);
  margin-top: 4px;
}

.summary-close {
  font-size: 13px;
  color: var(--danger);
  font-weight: 600;
  margin-top: 4px;
}

.mvp-display {
  text-align: center;
  padding: 8px 0;
}

.mvp-name {
  font-size: 18px;
  font-weight: 700;
}

.mvp-stats {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 6px;
}

.mvp-stat {
  font-size: 14px;
  color: var(--muted);
  font-weight: 500;
}

.advantage-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.advantage-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.advantage-item.adv-home {
  background: rgba(255, 107, 53, 0.12);
  color: var(--home);
}

.advantage-item.adv-away {
  background: rgba(26, 115, 232, 0.12);
  color: var(--away);
}

.adv-label {
  font-weight: 700;
}

.adv-team {
  opacity: 0.8;
}

/* History List */
.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-day {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.day-header {
  font-size: 14px;
  font-weight: 700;
  color: var(--muted);
  padding: 4px 0;
  border-bottom: 1px solid var(--border);
}

.game-card.finished {
  opacity: 0.85;
}

.game-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.game-label-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255, 107, 53, 0.15);
  color: var(--accent);
  font-weight: 600;
}

.series-text {
  font-size: 11px;
  color: var(--muted);
  margin-top: 4px;
}

.team-score.winner {
  color: var(--success);
  font-weight: 800;
}

/* Upcoming Games */
.game-card.upcoming {
  border-left: 3px solid var(--accent2);
  background: rgba(26, 115, 232, 0.04);
}

.game-card.upcoming:hover {
  background: rgba(26, 115, 232, 0.08);
}

.status-badge.upcoming {
  color: var(--accent2);
  font-weight: 600;
}

.predict-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(26, 115, 232, 0.15);
  color: var(--accent2);
  font-weight: 600;
  margin-left: auto;
}

.upcoming-scoreboard .sb-record {
  font-size: 14px;
  color: var(--muted);
  font-weight: 600;
  margin-top: 4px;
}

.upcoming-label {
  color: var(--accent) !important;
}

.upcoming-time {
  font-size: 14px !important;
  color: var(--muted) !important;
}

/* Record Compare */
.record-compare {
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 12px 0;
}

.record-team {
  text-align: center;
}

.record-city {
  display: block;
  font-size: 12px;
  color: var(--muted);
}

.record-val {
  display: block;
  font-size: 24px;
  font-weight: 800;
  color: var(--text);
}

.record-label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
}

.record-vs {
  font-size: 14px;
  color: var(--muted);
  font-weight: 700;
}
</style>

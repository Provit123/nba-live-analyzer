import axios from 'axios'

// 使用本地代理服务器，避免CORS问题
const API_BASE = '/api'

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
})

export const nbaService = {
  // 获取今日比赛记分板
  async getLiveScoreboard() {
    try {
      const res = await apiClient.get('/scoreboard')
      return res.data
    } catch (e) {
      console.error('获取记分板失败:', e)
      return null
    }
  },

  // 获取比赛详细数据(box score)
  async getBoxScore(gameId) {
    try {
      const res = await apiClient.get(`/boxscore/${gameId}`)
      return res.data
    } catch (e) {
      console.error('获取比赛详情失败:', e)
      return null
    }
  },

  // 获取play-by-play数据
  async getPlayByPlay(gameId) {
    try {
      const res = await apiClient.get(`/pbp/${gameId}`)
      return res.data
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

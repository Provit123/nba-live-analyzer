// 从NBA CDN抓取数据，存到gh-pages分支的data/目录
const https = require('https');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'dist', 'data');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Referer': 'https://www.nba.com/',
  'Accept': 'application/json',
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: HEADERS }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function main() {
  // 确保data目录存在
  fs.mkdirSync(DATA_DIR, { recursive: true });

  // 写入时间戳
  const timestamp = new Date().toISOString();
  console.log(`Fetching NBA data at ${timestamp}`);

  // 1. 抓取今日比分
  try {
    const scoreboard = await fetchJSON('https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json');
    fs.writeFileSync(path.join(DATA_DIR, 'scoreboard.json'), scoreboard, 'utf8');
    console.log('✅ scoreboard.json saved (' + scoreboard.length + ' bytes)');

    // 提取gameId
    const sb = JSON.parse(scoreboard);
    const games = sb.scoreboard?.games || [];
    console.log(`Found ${games.length} games today`);

    for (const game of games) {
      const gid = game.gameId;
      // 2. 抓boxscore
      try {
        const box = await fetchJSON(`https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gid}.json`);
        fs.writeFileSync(path.join(DATA_DIR, `boxscore_${gid}.json`), box, 'utf8');
        console.log(`✅ boxscore_${gid}.json saved`);
      } catch (e) {
        console.log(`⚠️ boxscore_${gid}.json failed: ${e.message}`);
      }

      // 3. 抓playbyplay
      try {
        const pbp = await fetchJSON(`https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gid}.json`);
        fs.writeFileSync(path.join(DATA_DIR, `playbyplay_${gid}.json`), pbp, 'utf8');
        console.log(`✅ playbyplay_${gid}.json saved`);
      } catch (e) {
        console.log(`⚠️ playbyplay_${gid}.json failed: ${e.message}`);
      }
    }
  } catch (e) {
    console.log(`❌ scoreboard failed: ${e.message}`);
  }

  // 4. 抓取赛程
  try {
    const schedule = await fetchJSON('https://cdn.nba.com/static/json/staticData/scheduleLeagueV2_1.json');
    fs.writeFileSync(path.join(DATA_DIR, 'schedule.json'), schedule, 'utf8');
    console.log('✅ schedule.json saved (' + schedule.length + ' bytes)');
  } catch (e) {
    console.log(`❌ schedule failed: ${e.message}`);
  }

  // 5. 写入更新时间戳
  fs.writeFileSync(path.join(DATA_DIR, 'timestamp.json'), JSON.stringify({ updatedAt: timestamp }), 'utf8');
  console.log('✅ timestamp.json saved');
  console.log('All done!');
}

main().catch(console.error);

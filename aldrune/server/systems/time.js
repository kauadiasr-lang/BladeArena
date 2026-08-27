// Astral Calendar: drives day/night, weather and the moon cycle that
// influences monster spawns, Rune Echo potency and corruption gain.
const MINUTES_PER_DAY = 1440;
const REAL_SECONDS_PER_GAME_MINUTE = 1; // 1 real second = 1 game minute -> 24min real per day
const MOON_PHASES = ['Nova', 'Crescente', 'Quarto Crescente', 'Cheia Cinzenta', 'Cheia Oca', 'Minguante', 'Quarto Minguante', 'Nova Escura'];
const DAYS_PER_MOON_CYCLE = 4;
const WEATHERS = ['claro', 'nublado', 'chuva', 'nevoa'];

export class AstralCalendar {
  constructor() {
    this.totalMinutes = 8 * 60; // start at 08:00
    this.weather = 'claro';
    this._weatherTimer = 0;
    this._acc = 0;
  }

  tick(dtSeconds) {
    this._acc += dtSeconds;
    while (this._acc >= REAL_SECONDS_PER_GAME_MINUTE) {
      this._acc -= REAL_SECONDS_PER_GAME_MINUTE;
      this.totalMinutes += 1;
    }
    this._weatherTimer -= dtSeconds;
    if (this._weatherTimer <= 0) {
      this._weatherTimer = 120 + Math.random() * 240;
      this.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    }
  }

  get day() { return Math.floor(this.totalMinutes / MINUTES_PER_DAY); }
  get minuteOfDay() { return this.totalMinutes % MINUTES_PER_DAY; }
  get hour() { return Math.floor(this.minuteOfDay / 60); }
  get minute() { return this.minuteOfDay % 60; }
  get isNight() { return this.hour >= 20 || this.hour < 6; }
  get moonPhaseIndex() { return Math.floor(this.day % DAYS_PER_MOON_CYCLE / DAYS_PER_MOON_CYCLE * MOON_PHASES.length) % MOON_PHASES.length; }
  get moonPhaseName() { return MOON_PHASES[this.moonPhaseIndex]; }
  get isHollowMoon() { return this.moonPhaseName === 'Cheia Oca'; }
  // Rune potency multiplier: dark runes surge under the Hollow Moon, light/life runes surge under Nova.
  runePotency(element) {
    if (this.isHollowMoon && (element === 'death' || element === 'shadow')) return 1.3;
    if (this.moonPhaseName === 'Nova' && element === 'heal') return 1.25;
    return 1.0;
  }
  corruptionGainMultiplier() { return this.isHollowMoon ? 1.5 : 1.0; }
  spawnMultiplier() { return this.isNight ? 1.4 : 1.0; }

  serialize() {
    return {
      day: this.day, hour: this.hour, minute: this.minute, isNight: this.isNight,
      moonPhase: this.moonPhaseName, weather: this.weather,
    };
  }
}

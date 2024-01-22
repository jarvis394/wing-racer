import * as PIXI from 'pixi.js'
import { Player as EnginePlayer } from '@wing-racer/engine'
import Player from './Player'
import { lerp } from '@wing-racer/shared'

class PlayerContainer extends PIXI.Container {
  enginePlayer: EnginePlayer
  player: Player

  constructor(enginePlayer: EnginePlayer) {
    super()
    this.enginePlayer = enginePlayer
    this.player = new Player(enginePlayer)
    this.position.set(
      enginePlayer.body.position.x,
      enginePlayer.body.position.y
    )

    this.addChild(this.player)
  }

  init() {
    // noop
  }

  update(_interpolation: number) {
    const position = this.enginePlayer.body.position

    this.position.set(
      lerp(this.position.x, position.x, 0.8),
      lerp(this.position.y, position.y, 0.8)
    )

    this.player.update()
  }
}

export default PlayerContainer

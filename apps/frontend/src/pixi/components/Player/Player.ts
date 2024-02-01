import * as PIXI from 'pixi.js'
import { Player as EnginePlayer } from '@wing-racer/engine'
import { degreesToRadian, lerp } from '@wing-racer/shared'
import Matter from 'matter-js'

class Player extends PIXI.Container {
  private static ANGLE_CORRECTION = -90
  private static POSITION_CORRECTION = Matter.Vector.create(8, 0)
  private static TRIANGLE_WIDTH = 40
  private static TRIANGLE_HEIGHT = 64
  private static TRIANGLE_TAIL_Y_OFFSET = 6
  enginePlayer: EnginePlayer
  player: PIXI.Graphics

  constructor(enginePlayer: EnginePlayer) {
    super()
    this.enginePlayer = enginePlayer
    this.rotation = enginePlayer.body.angle
    this.player = new PIXI.Graphics()

    const triangleWidthHalfway = Player.TRIANGLE_WIDTH / 2
    const triangleHeightHalfway = Player.TRIANGLE_HEIGHT / 2

    this.player.beginFill(0xeb4875, 1)
    this.player.moveTo(Player.TRIANGLE_WIDTH, 0)
    this.player.lineTo(triangleWidthHalfway, Player.TRIANGLE_HEIGHT)
    this.player.lineTo(0, 0)
    this.player.lineTo(triangleWidthHalfway, Player.TRIANGLE_TAIL_Y_OFFSET)
    this.player.endFill()

    this.player.pivot.set(triangleWidthHalfway, triangleHeightHalfway)
    this.player.position.set(
      Player.POSITION_CORRECTION.x,
      Player.POSITION_CORRECTION.y
    )
    this.player.rotation = degreesToRadian(Player.ANGLE_CORRECTION)

    this.addChild(this.player)
  }

  init() {
    // noop
  }

  update() {
    const engineAngle = this.enginePlayer.body.angle

    if (this.enginePlayer.isBoosting) {
      this.player.alpha = 1
    } else {
      this.player.alpha = 0.5
    }

    this.rotation = lerp(this.rotation, engineAngle, 0.7)
  }
}

export default Player

import Matter from 'matter-js'
import { World } from './World'
import { degreesToRadian, getAngleVector, lerp } from '@wing-racer/shared'

export type PlayerConstructorProps = {
  id: string
  position: Matter.Vector
  shipColor: ShipColor
  world: World
}

export enum ShipColor {
  RED,
  ORANGE,
  YELLOW,
  GREEN,
  CYAN,
  BLUE,
  PURPLE,
}

export class Player {
  public static LABEL_PREFIX = 'player_'
  public static HITBOX_RADIUS = 8
  public static BODY_RESTITUTION = 0
  public static VELOCITY = 6
  public static VELOCITY_FORCE = 0.00025
  public static BODY_FRICTION_AIR = 0.01
  public static ROTATE_ANGLE = 5
  public static PLAYER_COLLISION_CATEGORY = 0x0010
  public static BODY_MASS = 1
  public static ROTATION_TORQUE_FORCE = 0.0004
  public static ROTATION_VELOCITY = 0.045
  public static KNOCKBACK_FORCE = 0.008

  id: string
  world: World
  body: Matter.Body
  /** Угол поворота в градусах */
  angle: number
  isRotatingRight: boolean
  isRotatingLeft: boolean
  isBoosting: boolean
  /**
   * Флаг для обозначения игрока врагом. Изначально всегда `true`;
   * для главного игрока нужно ставить `World.setMe(player)`,
   * как и для игроков в команде главного игрока, чтобы изменить значение на `false`
   * @default true
   */
  isOpponent: boolean
  isMe: boolean
  /** Флаг для состояния, когда игрок обновляется по данным с сервера */
  isServerControlled: boolean
  shipColor: ShipColor
  latency: number
  private collision?: Matter.Collision

  constructor({ id, position, shipColor, world }: PlayerConstructorProps) {
    this.id = id
    this.world = world
    this.body = Player.createBody(position)
    this.body.label = Player.getLabelFromId(id)
    this.isRotatingRight = false
    this.isRotatingLeft = false
    this.isBoosting = true
    this.angle = 0
    this.isOpponent = true
    this.isMe = false
    this.isServerControlled = false
    this.shipColor = shipColor
    this.latency = 0

    Matter.Events.on(this.world.matterEngine, 'collisionStart', (event) => {
      for (const { bodyA, bodyB, collision } of event.pairs) {
        if (Player.isPlayer(bodyA) || Player.isPlayer(bodyB)) {
          this.stopBoosting()
          this.collision = collision
        }
      }
    })
    Matter.Events.on(this.world.matterEngine, 'collisionEnd', (event) => {
      for (const { bodyA, bodyB } of event.pairs) {
        if (Player.isPlayer(bodyA) || Player.isPlayer(bodyB)) {
          Matter.Body.setAngularVelocity(this.body, 0)
          setTimeout(() => this.startBoosting(), 500)
        }
      }
    })
    Matter.Events.on(this.world.matterEngine, 'beforeUpdate', () => {
      if (this.collision) {
        this.applyCollisionImpulse(this.collision)
        this.collision = undefined
      }
    })
  }

  public applyCollisionImpulse(collisionContact: Matter.Collision) {
    const contactNormal = Matter.Vector.rotate(
      collisionContact.normal,
      degreesToRadian(180)
    )
    const contactImpulse = Matter.Vector.mult(
      contactNormal,
      Player.KNOCKBACK_FORCE
    )

    Matter.Body.applyForce(this.body, this.body.position, contactImpulse)
    Matter.Body.setAngularVelocity(this.body, 0)
    this.body.torque = 0
  }

  public setServerControlled(state: boolean) {
    this.isServerControlled = state
  }

  public setLatency(latency: number) {
    this.latency = latency
  }

  public rotate(direction: 'left' | 'right') {
    switch (direction) {
      case 'left':
        this.isRotatingLeft = true
        break
      case 'right':
        this.isRotatingRight = true
        break
    }
  }

  public stopRotation(direction: 'left' | 'right') {
    switch (direction) {
      case 'left':
        this.isRotatingLeft = false
        break
      case 'right':
        this.isRotatingRight = false
        break
    }
  }

  public startBoosting() {
    this.isBoosting = true
  }

  public stopBoosting() {
    this.isBoosting = false
  }

  public update() {
    if (this.isServerControlled) return

    this.processRotate()
    this.processMovement()
  }

  public processMovement() {
    if (this.isBoosting) {
      Matter.Body.applyForce(
        this.body,
        this.body.position,
        Matter.Vector.mult(getAngleVector(this.body), Player.VELOCITY_FORCE)
      )
    }

    if (Matter.Body.getSpeed(this.body) > Player.VELOCITY) {
      Matter.Body.setSpeed(this.body, Player.VELOCITY)
    }
  }

  public processRotate() {
    if (this.isRotatingRight) {
      this.body.torque = Player.ROTATION_TORQUE_FORCE
    } else if (this.isRotatingLeft) {
      this.body.torque = -Player.ROTATION_TORQUE_FORCE
    }

    if (this.isRotatingRight || this.isRotatingLeft) {
      if (Matter.Body.getAngularSpeed(this.body) > Player.ROTATION_VELOCITY) {
        Matter.Body.setAngularSpeed(this.body, Player.ROTATION_VELOCITY)
      }
    } else {
      Matter.Body.setAngularSpeed(
        this.body,
        lerp(Matter.Body.getAngularSpeed(this.body), 0, 0.05)
      )
    }
  }

  public static getLabelFromId(id: string) {
    return Player.LABEL_PREFIX + id
  }

  public static getIdFromLabel(label: string) {
    return label.substring(Player.LABEL_PREFIX.length)
  }

  public static isPlayer(body: Matter.Body) {
    return body.label.startsWith(Player.LABEL_PREFIX)
  }

  public static createBody(position: Matter.Vector): Matter.Body {
    return Matter.Bodies.circle(position.x, position.y, Player.HITBOX_RADIUS, {
      frictionAir: Player.BODY_FRICTION_AIR,
      restitution: Player.BODY_RESTITUTION,
      mass: Player.BODY_MASS,
      frictionStatic: 0,
      friction: 0,
      angularVelocity: 0,
      collisionFilter: {
        category: Player.PLAYER_COLLISION_CATEGORY,
      },
    })
  }
}

import Matter from 'matter-js'
import { World } from './World'
import { degreesToRadian, getAngleVector, lerp, map } from '@wing-racer/shared'

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

// TODO rewrite
const raycast = (
  bodies: Matter.Body[],
  start: Matter.Vector,
  r: Matter.Vector,
  dist: number
) => {
  let ray = r
  for (let i = 0; i < dist; i++) {
    ray = Matter.Vector.mult(r, i)
    ray = Matter.Vector.add(start, ray)
    const body = Matter.Query.point(bodies, ray)[0]

    if (body) {
      return { point: ray, body: body }
    }
  }
  return
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
  public static COLLISION_CONTACT_NORMAL_THRESHOLD = 1e-10

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
  rays: Array<
    | {
        point: Matter.Vector
        body: Matter.Body
      }
    | undefined
  >
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
    this.rays = []

    Matter.Events.on(this.world.matterEngine, 'collisionStart', (event) => {
      for (const { bodyA, bodyB, collision } of event.pairs) {
        if (Player.isPlayer(bodyA) || Player.isPlayer(bodyB)) {
          this.stopBoosting()
          this.collision = collision
          break
        }
      }
    })
    Matter.Events.on(this.world.matterEngine, 'collisionEnd', (event) => {
      for (const { bodyA, bodyB } of event.pairs) {
        if (Player.isPlayer(bodyA) || Player.isPlayer(bodyB)) {
          Matter.Body.setAngularVelocity(this.body, 0)
          setTimeout(
            () => this.startBoosting(),
            500 / this.world.matterEngine.timing.timeScale
          )
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

    if (Math.abs(contactNormal.x) < Player.COLLISION_CONTACT_NORMAL_THRESHOLD)
      contactNormal.x = 0
    if (Math.abs(contactNormal.y) < Player.COLLISION_CONTACT_NORMAL_THRESHOLD)
      contactNormal.y = 0

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
        Matter.Vector.sub(
          this.body.position,
          Matter.Vector.mult(
            Matter.Vector.neg(getAngleVector(this.body)),
            Player.HITBOX_RADIUS
          )
        ),
        Matter.Vector.mult(getAngleVector(this.body), Player.VELOCITY_FORCE)
      )
    }

    // const ray = Matter.Query.ray(
    //   this.world.map?.composite.bodies || [],
    //   this.body.position,
    //   Matter.Vector.mult(Matter.Vector.neg(getAngleVector(this.body)), 1000)
    // )

    // console.log(ray)

    if (Matter.Body.getSpeed(this.body) > Player.VELOCITY) {
      Matter.Body.setSpeed(this.body, Player.VELOCITY)
    }

    if (!this.isBoosting || !this.world.map) return

    const negAngleVector = Matter.Vector.neg(getAngleVector(this.body))
    const allBodies = Matter.Composite.allBodies(this.world.map.composite)
    // TODO export as static
    const N_RAYS = 16
    const DEGREE = 75
    const RAY_DIST = 75
    const rays = new Array(N_RAYS).fill(null).map((_, i) => {
      const degree = map(i, 0, N_RAYS - 1, -DEGREE, DEGREE)
      const vector = Matter.Vector.rotate(
        negAngleVector,
        degreesToRadian(degree)
      )

      return raycast(allBodies, this.body.position, vector, RAY_DIST)
    })

    let resultingForce = Matter.Vector.create()

    rays.forEach((ray) => {
      if (!ray) return

      const sub = Matter.Vector.sub(this.body.position, ray.point)
      const distance = Matter.Vector.magnitude(sub)
      const forceMult = 1 - map(distance, 0, RAY_DIST, 0, 1)
      const force = Matter.Vector.mult(
        Matter.Vector.normalise(sub),
        forceMult * Player.VELOCITY_FORCE
      )
      resultingForce = Matter.Vector.add(resultingForce, force)
      Matter.Body.applyForce(this.body, this.body.position, force)
    })

    resultingForce = Matter.Vector.mult(
      Matter.Vector.normalise(resultingForce),
      Player.VELOCITY_FORCE
    )
    // const force = 3 - map(distanceFromWall, 0, 75, 0, 3)
    // Matter.Body.applyForce(this.body, this.body.position, resultingForce)

    // const rayLeft = raycast(
    //   Matter.Composite.allBodies(this.world.map?.composite),
    //   this.body.position,
    //   Matter.Vector.rotate(negAngleVector, degreesToRadian(-30)),
    //   75
    // )
    // const rayCenter = raycast(
    //   Matter.Composite.allBodies(this.world.map?.composite),
    //   this.body.position,
    //   negAngleVector,
    //   75
    // )
    // const rayRight = raycast(
    //   Matter.Composite.allBodies(this.world.map?.composite),
    //   this.body.position,
    //   Matter.Vector.rotate(negAngleVector, degreesToRadian(30)),
    //   75
    // )

    // const distances = rays.sort((a, b) =>
    //   a && b ? b.distance - a.distance : 1
    // )
    // const minDistanceRay = distances.at(0)
    // console.log(minDistanceRay)
    // if (minDistanceRay !== undefined) {
    //   const force = 3 - map(minDistanceRay.distance, 0, 75, 0, 3) / 100
    //   Matter.Body.applyForce(
    //     this.body,
    //     this.body.position,
    //     // minDistanceRay.point,
    //     Matter.Vector.mult(
    //       getAngleVector(this.body),
    //       Player.VELOCITY_FORCE * force
    //     )
    //   )
    // }

    // distances.forEach((ray) => {
    //   if (!ray) return

    //   const force = 3 - map(ray.distance, 0, 75, 0, 3)
    //   Matter.Body.applyForce(
    //     this.body,
    //     ray.point,
    //     Matter.Vector.mult(
    //       getAngleVector(this.body),
    //       (Player.VELOCITY_FORCE * force) / 10000
    //     )
    //   )
    // })

    this.rays = rays

    // this.raycastCollision = rayLeft || rayCenter || rayRight

    // if (this.raycastCollision) {
    //   const force = 3 - map(distanceFromWall, 0, 75, 0, 3)
    //   Matter.Body.applyForce(
    //     this.body,
    //     this.raycastCollision.point,
    //     Matter.Vector.mult(
    //       getAngleVector(this.body),
    //       Player.VELOCITY_FORCE * force
    //     )
    //   )
    // }
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

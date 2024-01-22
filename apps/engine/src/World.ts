import Matter from 'matter-js'
import { Player, ShipColor } from './Player'
import { EventEmitter } from './EventEmitter'
import { degreesToRadian } from '@wing-racer/shared'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-expect-error
import decomp from 'poly-decomp'

export enum WorldEvents {
  PLAYER_SPAWN = 'player_spawn',
  PLAYER_DESPAWN = 'player_despawn',
}

type WorldEmitterEvents = {
  [WorldEvents.PLAYER_SPAWN]: (playerId: string) => void
  [WorldEvents.PLAYER_DESPAWN]: (playerId: string) => void
}

export class World extends EventEmitter<WorldEmitterEvents> {
  public static WORLD_HEIGHT = 1100
  public static WORLD_WIDTH = 1100
  public static WALL_COLLISION_CATEGORY = 0x0001
  private static WALL_HEIGHT = 50
  private static WALL_PREFIX = 'wall'

  instance: Matter.World
  matterEngine: Matter.Engine
  mapData?: Matter.Vector[][]
  map?: Matter.Composite
  players: Map<string, Player> = new Map()

  constructor({ matterEngine }: { matterEngine: Matter.Engine }) {
    super()
    this.instance = matterEngine.world
    this.matterEngine = matterEngine
    this.addObstacles()
  }

  public parseMap(map: string): Matter.Vector[][] {
    const lines = map.split('\n')
    const data: Matter.Vector[][] = [[]]
    let currentBody = 0

    lines.forEach((line) => {
      if (line === '#') {
        currentBody++
        data.push([])
        return
      }

      const [x, y] = line.split(',')

      if (!x || !y) {
        throw new Error('Wrong map data format')
      }

      data[currentBody]?.push({
        x: Number(x),
        y: Number(y),
      })
    })

    // return data
    return [[]]
  }

  public loadMap(map: string) {
    const parsedMap = this.parseMap(map)
    const wallOptions: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0,
      restitution: 0,
      mass: 0,
      label: World.WALL_PREFIX,
      collisionFilter: {
        category: World.WALL_COLLISION_CATEGORY,
      },
    }

    const body = Matter.Composite.add(
      this.matterEngine.world,
      Matter.Bodies.fromVertices(0, 0, parsedMap, wallOptions)
    )

    Matter.Composite.translate(body, { x: 235 / 2, y: 200 / 2 })
    Matter.Composite.scale(body, 2, 2, { x: 0, y: 0 })

    this.mapData = parsedMap
    this.map = body
  }

  public createPlayer(id: string): Player {
    const spawnPositions = [
      Matter.Vector.create(100, 100),
      Matter.Vector.create(World.WORLD_WIDTH - 100, World.WORLD_HEIGHT - 100),
      Matter.Vector.create(World.WORLD_WIDTH - 100, 100),
      Matter.Vector.create(100, World.WORLD_HEIGHT - 100),
    ]
    const n = this.players.size % spawnPositions.length
    const player = new Player({
      id,
      position: spawnPositions[n] as Matter.Vector,
      shipColor: ShipColor.BLUE,
      world: this,
    })

    return player
  }

  public addPlayer(player: Player): Player {
    this.players.set(player.id, player)
    this.eventEmitter.emit(WorldEvents.PLAYER_SPAWN, player.id)
    Matter.World.addBody(this.instance, player.body)
    return player
  }

  public removePlayer(id: string): boolean {
    const player = this.players.get(id)

    if (!player) return false

    Matter.World.remove(this.instance, player.body)
    this.eventEmitter.emit(WorldEvents.PLAYER_DESPAWN, player.id)
    return this.players.delete(id)
  }

  public update() {
    this.players.forEach((player) => {
      player.update()
    })
  }

  private addObstacles(): Matter.Body[] {
    const wallOptions: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0,
      restitution: 0,
      mass: 0,
      label: World.WALL_PREFIX,
      collisionFilter: {
        category: World.WALL_COLLISION_CATEGORY,
      },
    }

    // const select = function (root: Document, selector: string) {
    //   return Array.prototype.slice.call(root.querySelectorAll(selector))
    // }

    Matter.Common.setDecomp(decomp)

    // const vertexSets: Matter.Vector[][] = select(
    //   new window.DOMParser().parseFromString(
    //     `<svg xmlns="http://www.w3.org/2000/svg" width="2350" height="2000" viewBox="0 0 2350 2000" fill="none">
    //     <path fill-rule="evenodd" clip-rule="evenodd" d="M800 275L1100 425H1600C1751.88 425 1875 548.122 1875 700V1300C1875 1451.88 1751.88 1575 1600 1575H1100L800 1725C744.771 1725 700 1680.23 700 1625V375C700 319.771 744.771 275 800 275ZM1101.89 1583L801.889 1733H800C740.353 1733 692 1684.65 692 1625V375C692 315.353 740.353 267 800 267H801.889L1101.89 417H1600C1756.3 417 1883 543.703 1883 700V1300C1883 1456.3 1756.3 1583 1600 1583H1101.89ZM500 8C228.276 8 8 228.276 8 500V1500C8 1771.72 228.276 1992 500 1992H1600C2009.8 1992 2342 1659.8 2342 1250V750C2342 340.205 2009.8 8 1600 8H500ZM0 500C0 223.858 223.857 0 500 0H1600C2014.21 0 2350 335.786 2350 750V1250C2350 1664.21 2014.21 2000 1600 2000H500C223.857 2000 0 1776.14 0 1500V500Z" fill="white"/>
    //   </svg>`,
    //     'image/svg+xml'
    //   ),
    //   'path'
    // ).map((path: SVGPathElement) => Matter.Svg.pathToVertices(path, 20))

    // const field = Matter.Composite.add(
    //   this.matterEngine.world,
    //   Matter.Bodies.fromVertices(
    //     0,
    //     0,
    //     vertexSets,
    //     wallOptions
    //   )
    // )

    // Matter.Composite.translate(field, { x: 235 / 2, y: 235 / 2 })
    // Matter.Composite.scale(field, 4, 4, { x: 0, y: 0 })

    const bodies = [
      Matter.Bodies.circle(
        World.WORLD_WIDTH / 2,
        World.WORLD_HEIGHT / 2,
        World.WALL_HEIGHT * 2,
        wallOptions
      ),
      Matter.Bodies.rectangle(
        500,
        75,
        World.WALL_HEIGHT * 2,
        World.WALL_HEIGHT * 2,
        { ...wallOptions, angle: degreesToRadian(45) }
      ),
    ]

    // Matter.World.add(this.instance, bodies)

    return bodies
  }
}

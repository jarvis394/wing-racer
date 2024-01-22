import Matter from 'matter-js'

export class Map {
  public static LABEL = 'map'
  raw: string
  points: Matter.Vector[][]
  body?: Matter.Body

  constructor(raw: string) {
    this.raw = raw
    this.points = this.parseRaw(this.raw)
    this.body = Map.createBody(this.points)
  }

  parseRaw(raw: string): Matter.Vector[][] {
    const lines = raw.split('\n')
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

    return data
  }

  public static createBody(points: Matter.Vector[][]): Matter.Body {
    const options: Matter.IChamferableBodyDefinition = {
      isStatic: true,
      friction: 0,
      restitution: 0,
      mass: 0,
      label: Map.LABEL,
    }

    return Matter.Bodies.fromVertices(0, 0, points, options)

    // Matter.Composite.translate(body, { x: 235 / 2, y: 200 / 2 })
    // Matter.Composite.scale(body, 2, 2, { x: 0, y: 0 })
  }
}

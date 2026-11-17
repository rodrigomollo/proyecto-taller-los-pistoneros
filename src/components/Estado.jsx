import { ESTADOS } from '../utils.js'

export default function Estado({ valor }) {
  return <span className={`estado estado-${valor}`}>{ESTADOS[valor] ?? valor}</span>
}

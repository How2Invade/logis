import { Box, Cyl } from '../primitives';
import { NodeLabel, StatusRing, pickHandlers, useToneMaterials, type NodeProps } from './NodeDecor';

const TEETH = [-5.6, -3, -0.4, 2.2];

export function Plant({ node, placement, state, selected, onSelect }: NodeProps) {
  const p = state.palette;
  const { solid, glow } = useToneMaterials(node, state);
  return (
    <>
      <group position={[placement.x, 0, placement.z]} rotation={[0, placement.rot, 0]} {...pickHandlers(node.id, state, onSelect)}>
        <Box size={[15, 0.06, 13]} color={p.concrete} position={[0, 0.21, 0]} />
        <Box size={[10.6, 5, 10]} color={p.houseBody} position={[-1.8, 2.7, -0.6]} cast />
        <Box size={[10.7, 0.35, 10.1]} material={solid} position={[-1.8, 5.1, -0.6]} />
        {TEETH.map((x) => (
          <group key={x}>
            <Box size={[2.9, 0.25, 10]} color={p.roof} position={[x, 5.95, -0.6]} rotation={[0, 0, 0.5]} cast />
            <Box size={[0.18, 1.3, 9.8]} color={p.blue} position={[x + 1.25, 5.85, -0.6]} />
          </group>
        ))}
        <Box size={[2.2, 2.6, 0.08]} color={p.door} position={[-4.5, 1.5, 4.42]} />
        <Box size={[2.2, 2.6, 0.08]} color={p.door} position={[-1, 1.5, 4.42]} />
        <Cyl r={0.55} h={9} rTop={0.45} color={p.metal} position={[-5.8, 4.7, -4.2]} cast />
        <Cyl r={0.6} h={0.5} color={p.tone.affected} position={[-5.8, 8.9, -4.2]} />
        <Cyl r={1.4} h={4} color={p.roof} position={[5.4, 2.2, -3]} cast />
        <Cyl r={1.4} h={4} color={p.roof} position={[5.4, 2.2, 0.6]} cast />
        <Box size={[0.3, 0.3, 3.6]} color={p.metal} position={[5.4, 4.3, -1.2]} />
        <StatusRing material={glow} radius={8.6} />
      </group>
      <NodeLabel node={node} state={state} x={placement.x} z={placement.z} y={8.4} minZoom={0} selected={selected} />
    </>
  );
}

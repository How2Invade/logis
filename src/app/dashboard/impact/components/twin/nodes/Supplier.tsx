import { Box, Cyl, mat, sphereGeo } from '../primitives';
import { NodeLabel, StatusRing, pickHandlers, useToneMaterials, type NodeProps } from './NodeDecor';

export function Supplier({ node, placement, state, selected, onSelect }: NodeProps) {
  const p = state.palette;
  const { solid, glow } = useToneMaterials(node, state);
  return (
    <>
      <group position={[placement.x, 0, placement.z]} rotation={[0, placement.rot, 0]} {...pickHandlers(node.id, state, onSelect)}>
        <Box size={[11, 0.06, 10]} color={p.concrete} position={[0, 0.21, 0]} />
        <Box size={[4.6, 3, 4]} color={p.barn} position={[-1.8, 1.7, -0.5]} cast />
        <Box size={[2.7, 0.25, 4.4]} color={p.roof} position={[-2.95, 3.7, -0.5]} rotation={[0, 0, 0.55]} cast />
        <Box size={[2.7, 0.25, 4.4]} color={p.roof} position={[-0.65, 3.7, -0.5]} rotation={[0, 0, -0.55]} cast />
        <Box size={[0.4, 0.32, 4.5]} material={solid} position={[-1.8, 4.3, -0.5]} />
        <Box size={[1.6, 2, 0.06]} color={p.door} position={[-1.8, 1.2, 1.53]} />
        <Cyl r={1.1} h={5} color={p.roof} position={[2.4, 2.7, -1.6]} cast />
        <mesh geometry={sphereGeo(1.1)} material={mat(p.metal)} position={[2.4, 5.2, -1.6]} dispose={null} />
        <Cyl r={0.75} h={3} color={p.metal} position={[2.6, 1.0, 2]} rotation={[0, 0, Math.PI / 2]} cast />
        <StatusRing material={glow} radius={6.2} pulse={node.isSource} />
      </group>
      <NodeLabel node={node} state={state} x={placement.x} z={placement.z} y={6.6} minZoom={0} selected={selected} />
    </>
  );
}

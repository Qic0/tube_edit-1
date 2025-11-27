import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, GizmoHelper, GizmoViewport } from "@react-three/drei";
import { PipeConfig } from "@/types/pipe";
import * as THREE from "three";
import { useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Eye, Box } from "lucide-react";

interface PipeViewer3DProps {
  config: PipeConfig;
}

// Создание геометрии круглой трубы со срезами
function createRoundPipeGeometry(
  radius: number,
  length: number,
  leftCut: string,
  rightCut: string
): THREE.BufferGeometry {
  const segments = 64;
  const geometry = new THREE.CylinderGeometry(radius, radius, length, segments, 1, false);
  
  // Поворачиваем цилиндр так, чтобы он лежал вдоль оси Z
  geometry.rotateX(Math.PI / 2);
  
  const positions = geometry.attributes.position;
  const halfLength = length / 2;
  
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    let z = positions.getZ(i);
    
    // Левый срез (отрицательная Z)
    if (leftCut === "Угловой срез 45°" && z < -halfLength + radius * 2) {
      const offset = (y + radius) * Math.tan(Math.PI / 4);
      if (z < -halfLength + offset) {
        z = -halfLength + offset;
        positions.setZ(i, z);
      }
    }
    
    // Правый срез (положительная Z)
    if (rightCut === "Угловой срез 45°" && z > halfLength - radius * 2) {
      const offset = (y + radius) * Math.tan(Math.PI / 4);
      if (z > halfLength - offset) {
        z = halfLength - offset;
        positions.setZ(i, z);
      }
    }
  }
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  return geometry;
}

// Создание геометрии прямоугольной/квадратной трубы со срезами
function createBoxPipeGeometry(
  width: number,
  height: number,
  length: number,
  leftCut: string,
  rightCut: string
): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(width, height, length, 1, 1, 32);
  
  const positions = geometry.attributes.position;
  const halfLength = length / 2;
  const cutDepth = Math.max(width, height);
  
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    let z = positions.getZ(i);
    
    // Левый срез (отрицательная Z)
    if (leftCut === "Угловой срез 45°") {
      const offset = (y + height / 2) * Math.tan(Math.PI / 4);
      const cutZ = -halfLength + offset;
      if (z < cutZ) {
        z = cutZ;
        positions.setZ(i, z);
      }
    }
    
    // Правый срез (положительная Z)
    if (rightCut === "Угловой срез 45°") {
      const offset = (y + height / 2) * Math.tan(Math.PI / 4);
      const cutZ = halfLength - offset;
      if (z > cutZ) {
        z = cutZ;
        positions.setZ(i, z);
      }
    }
  }
  
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  
  return geometry;
}

// Компонент для отображения плоскости среза
function CutPlane({ 
  position, 
  rotation, 
  size, 
  visible 
}: { 
  position: [number, number, number]; 
  rotation: [number, number, number];
  size: number;
  visible: boolean;
}) {
  if (!visible) return null;
  
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[size * 3, size * 3]} />
      <meshBasicMaterial 
        color="#ef4444" 
        transparent 
        opacity={0.4} 
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function PipeMesh({ config }: PipeViewer3DProps) {
  const scale = 0.01;
  
  const { geometry, pipeSize } = useMemo(() => {
    const length = config.dimensions.length * scale;
    
    if (config.shape === "Круглая" && config.dimensions.diameter) {
      const radius = (config.dimensions.diameter / 2) * scale;
      return {
        geometry: createRoundPipeGeometry(
          radius, 
          length, 
          config.edgeCuts.left, 
          config.edgeCuts.right
        ),
        pipeSize: radius * 2,
      };
    }
    
    if (config.shape === "Квадратная" && config.dimensions.width) {
      const size = config.dimensions.width * scale;
      return {
        geometry: createBoxPipeGeometry(
          size, 
          size, 
          length, 
          config.edgeCuts.left, 
          config.edgeCuts.right
        ),
        pipeSize: size,
      };
    }
    
    if (config.shape === "Прямоугольная" && config.dimensions.width && config.dimensions.height) {
      const width = config.dimensions.width * scale;
      const height = config.dimensions.height * scale;
      return {
        geometry: createBoxPipeGeometry(
          width, 
          height, 
          length, 
          config.edgeCuts.left, 
          config.edgeCuts.right
        ),
        pipeSize: Math.max(width, height),
      };
    }
    
    return { geometry: null, pipeSize: 1 };
  }, [config]);
  
  const halfLength = (config.dimensions.length * scale) / 2;
  
  if (!geometry) return null;
  
  return (
    <group>
      {/* Основная труба */}
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color="#a8a8a8" 
          metalness={0.8} 
          roughness={0.2}
        />
      </mesh>
      
      {/* Плоскость левого среза */}
      <CutPlane
        position={[-pipeSize / 2, 0, -halfLength + pipeSize / 2]}
        rotation={[0, Math.PI / 4, 0]}
        size={pipeSize}
        visible={config.edgeCuts.left === "Угловой срез 45°"}
      />
      
      {/* Плоскость правого среза */}
      <CutPlane
        position={[pipeSize / 2, 0, halfLength - pipeSize / 2]}
        rotation={[0, -Math.PI / 4, 0]}
        size={pipeSize}
        visible={config.edgeCuts.right === "Угловой срез 45°"}
      />
    </group>
  );
}

// Компонент для авто-подгонки камеры
function CameraController({ config }: { config: PipeConfig }) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  
  useEffect(() => {
    const length = config.dimensions.length * 0.01;
    const distance = Math.max(length * 0.8, 15);
    
    camera.position.set(distance * 0.5, distance * 0.3, distance * 0.5);
    camera.lookAt(0, 0, 0);
    
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  }, [config, camera]);
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.1}
      rotateSpeed={0.8}
      zoomSpeed={1.2}
      panSpeed={0.8}
      minDistance={5}
      maxDistance={200}
    />
  );
}

// Внутренний компонент сцены
function Scene({ config }: PipeViewer3DProps) {
  return (
    <>
      <CameraController config={config} />
      
      {/* Улучшенное освещение */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 20, 10]} 
        intensity={1}
        castShadow
      />
      <directionalLight 
        position={[-10, 10, -10]} 
        intensity={0.5}
      />
      <pointLight position={[0, -10, 0]} intensity={0.3} />
      
      {/* Труба */}
      <PipeMesh config={config} />
      
      {/* Сетка */}
      <gridHelper 
        args={[100, 50, "#cccccc", "#e5e5e5"]} 
        rotation={[0, 0, 0]}
      />
      
      {/* Оси координат */}
      <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
        <GizmoViewport 
          axisColors={["#ef4444", "#22c55e", "#3b82f6"]} 
          labelColor="white" 
        />
      </GizmoHelper>
    </>
  );
}

export function PipeViewer3D({ config }: PipeViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const resetCamera = () => {
    // Перезагрузка компонента для сброса камеры
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.dispatchEvent(new Event('reset'));
    }
  };

  return (
    <div className="w-full h-full flex flex-col rounded-lg overflow-hidden bg-gradient-to-b from-muted/30 to-muted/50">
      {/* Панель управления */}
      <div className="flex items-center gap-2 p-2 bg-card border-b border-border">
        <Button variant="outline" size="sm" onClick={resetCamera}>
          <RotateCcw className="w-4 h-4 mr-1" />
          Сброс
        </Button>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Eye className="w-3 h-3" />
          <span>ЛКМ: вращение</span>
          <span>ПКМ: перемещение</span>
          <span>Колесо: масштаб</span>
        </div>
      </div>
      
      {/* 3D Canvas */}
      <div className="flex-1">
        <Canvas
          ref={canvasRef}
          shadows
          gl={{ antialias: true }}
          dpr={[1, 2]}
        >
          <PerspectiveCamera makeDefault position={[30, 20, 30]} fov={50} />
          <Scene config={config} />
        </Canvas>
      </div>
    </div>
  );
}

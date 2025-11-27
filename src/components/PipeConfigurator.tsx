import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  PipeShape, 
  PIPE_SIZES, 
  EDGE_CUT_OPTIONS,
  parsePipeSize, 
  PipeConfig, 
  EdgeCutType,
  calculateCutPrice,
  calculateTotalCutLength
} from "@/types/pipe";
import { Check, Scissors } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PipeConfiguratorProps {
  config: PipeConfig;
  onChange: (config: PipeConfig) => void;
  onFinish: () => void;
}

export function PipeConfigurator({ config, onChange, onFinish }: PipeConfiguratorProps) {
  const [length, setLength] = useState("6000");
  const [selectedShape, setSelectedShape] = useState<PipeShape | "">("");
  const [selectedSize, setSelectedSize] = useState("");

  const handleConfirm = () => {
    if (selectedShape && selectedSize && length) {
      const dimensions = parsePipeSize(selectedSize, selectedShape as PipeShape);
      dimensions.length = parseInt(length);
      onChange({
        shape: selectedShape as PipeShape,
        size: selectedSize,
        dimensions,
        edgeCuts: {
          left: "Прямой срез",
          right: "Прямой срез",
        },
        confirmed: true,
      });
    }
  };

  const handleShapeSelect = (shape: PipeShape) => {
    setSelectedShape(shape);
    setSelectedSize("");
  };

  const handleLeftCutChange = (value: EdgeCutType) => {
    onChange({
      ...config,
      edgeCuts: {
        ...config.edgeCuts,
        left: value,
      },
    });
  };

  const handleRightCutChange = (value: EdgeCutType) => {
    onChange({
      ...config,
      edgeCuts: {
        ...config.edgeCuts,
        right: value,
      },
    });
  };

  const handleFinish = () => {
    onFinish();
    setSelectedShape("");
    setSelectedSize("");
    setLength("6000");
  };

  if (!config.confirmed) {
    return (
      <Card className="bg-card">
        <CardContent className="pt-6 space-y-4">
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Выбор профиля
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Левая колонка - форма */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Форма профиля</p>
                <div className="space-y-2">
                  {(["Круглая", "Квадратная", "Прямоугольная"] as PipeShape[]).map((shape) => (
                    <Button
                      key={shape}
                      variant={selectedShape === shape ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleShapeSelect(shape)}
                      className="w-full justify-start"
                    >
                      {shape}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Правая колонка - размер */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground mb-2">Размер профиля</p>
                {selectedShape ? (
                  <div className="space-y-2 max-h-[120px] overflow-y-auto">
                    {PIPE_SIZES[selectedShape as PipeShape].map((size) => (
                      <Button
                        key={size}
                        variant={selectedSize === size ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedSize(size)}
                        className="w-full justify-start"
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Сначала выберите форму
                  </p>
                )}
              </div>
            </div>
          </div>

          {selectedShape && selectedSize && (
            <>
              <div>
                <Label htmlFor="length" className="text-sm font-medium">
                  Длина детали (мм)
                </Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    id="length"
                    type="number"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="6000"
                    min="1"
                    max="6000"
                    className="bg-background"
                  />
                  <Button onClick={handleConfirm} size="default">
                    OK
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                <p>Выбрано: {selectedShape} {selectedSize}</p>
                <p>Длина: {length} мм</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="bg-card">
        <CardContent className="pt-4">
          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Форма:</span>
              <span className="font-medium">{config.shape}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Размер:</span>
              <span className="font-medium">{config.size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Длина:</span>
              <span className="font-medium">{config.dimensions.length} мм</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardContent className="pt-4 space-y-4">
          <Label className="text-sm font-medium">Срезы краёв</Label>
          
          {/* Левый край */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Левый край</Label>
            <Select
              value={config.edgeCuts.left}
              onValueChange={(value) => handleLeftCutChange(value as EdgeCutType)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDGE_CUT_OPTIONS.map((cut) => (
                  <SelectItem key={cut} value={cut}>
                    {cut}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Правый край */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Правый край</Label>
            <Select
              value={config.edgeCuts.right}
              onValueChange={(value) => handleRightCutChange(value as EdgeCutType)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDGE_CUT_OPTIONS.map((cut) => (
                  <SelectItem key={cut} value={cut}>
                    {cut}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Визуальная схема */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <div 
                  className={`w-4 h-4 border-2 ${
                    config.edgeCuts.left === "Угловой срез 45°" 
                      ? "border-destructive bg-destructive/20" 
                      : "border-muted-foreground"
                  }`}
                  style={{
                    clipPath: config.edgeCuts.left === "Угловой срез 45°" 
                      ? "polygon(100% 0, 100% 100%, 0 100%)" 
                      : "none"
                  }}
                />
                <span>{config.edgeCuts.left === "Угловой срез 45°" ? "45°" : "90°"}</span>
              </div>
              
              <div className="flex-1 h-3 mx-2 bg-muted rounded-sm" />
              
              <div className="flex items-center gap-1">
                <span>{config.edgeCuts.right === "Угловой срез 45°" ? "45°" : "90°"}</span>
                <div 
                  className={`w-4 h-4 border-2 ${
                    config.edgeCuts.right === "Угловой срез 45°" 
                      ? "border-destructive bg-destructive/20" 
                      : "border-muted-foreground"
                  }`}
                  style={{
                    clipPath: config.edgeCuts.right === "Угловой срез 45°" 
                      ? "polygon(0 0, 100% 100%, 0 100%)" 
                      : "none"
                  }}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Стоимость резки */}
      <Card className="bg-card border-primary/30">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Scissors className="w-4 h-4 text-primary" />
            <Label className="text-sm font-medium">Стоимость резки</Label>
          </div>
          <div className="text-sm space-y-1">
            <div className="flex justify-between text-muted-foreground">
              <span>Длина реза:</span>
              <span>{(calculateTotalCutLength(config) / 1000).toFixed(3)} м</span>
            </div>
            <div className="flex justify-between font-bold text-lg">
              <span>Итого:</span>
              <span className="text-primary">{calculateCutPrice(config).toFixed(2)} ₽</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleFinish} className="w-full" size="lg">
        <Check className="w-4 h-4 mr-2" />
        Готова деталь
      </Button>
    </div>
  );
}

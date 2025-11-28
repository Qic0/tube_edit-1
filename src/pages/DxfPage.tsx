import { useState, useMemo } from "react";
import { DxfUploader } from "@/components/DxfUploader";
import { DxfViewer } from "@/components/DxfViewer";
import { NestingViewer } from "@/components/NestingViewer";
import { MaterialSelector } from "@/components/MaterialSelector";
import { MainNav } from "@/components/MainNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Trash2, Edit, Package } from "lucide-react";
import { calculateNesting } from "@/lib/dxfNesting";
import type { NestingResult } from "@/lib/dxf/types";
import {
  DxfConfig,
  FinishedDxfPart,
  createDefaultDxfConfig,
  calculateDxfPrice,
  MaterialType,
} from "@/types/dxf";
import { toast } from "@/hooks/use-toast";

export default function DxfPage() {
  const [dxfConfig, setDxfConfig] = useState<DxfConfig>(createDefaultDxfConfig());
  const [finishedParts, setFinishedParts] = useState<FinishedDxfPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(true);
  const [selectedNestingVariant, setSelectedNestingVariant] = useState(0);

  // Расчет раскроя
  const nestingResults = useMemo<NestingResult[]>(() => {
    // Определяем текущую конфигурацию для расчета
    let currentDisplayConfig: DxfConfig | null = null;
    
    if (selectedPartId && !isCreatingNew) {
      const part = finishedParts.find((p) => p.id === selectedPartId);
      currentDisplayConfig = part ? part.config : null;
    } else {
      currentDisplayConfig = dxfConfig.fileName ? dxfConfig : null;
    }
    
    if (!currentDisplayConfig?.fileContent || !currentDisplayConfig?.thickness) {
      return [];
    }
    
    try {
      return calculateNesting(currentDisplayConfig.fileContent, currentDisplayConfig.thickness);
    } catch (error) {
      console.error("Error calculating nesting:", error);
      return [];
    }
  }, [dxfConfig, finishedParts, selectedPartId, isCreatingNew]);

  const handleFileLoaded = (fileName: string, content: string, vectorLength: number) => {
    const price = calculateDxfPrice(vectorLength);
    setDxfConfig({
      ...dxfConfig,
      fileName,
      fileContent: content,
      vectorLength,
      price,
    });
    setIsCreatingNew(true);
    setSelectedPartId(null);
  };

  const handleMaterialChange = (material: MaterialType) => {
    const price = calculateDxfPrice(dxfConfig.vectorLength);
    setDxfConfig({ ...dxfConfig, material, price });
  };

  const handleThicknessChange = (thickness: number) => {
    const price = calculateDxfPrice(dxfConfig.vectorLength);
    setDxfConfig({ ...dxfConfig, thickness, price });
  };

  const handleFinishPart = () => {
    if (!dxfConfig.fileName) {
      toast({
        title: "Ошибка",
        description: "Загрузите DXF файл",
        variant: "destructive",
      });
      return;
    }

    const newPart: FinishedDxfPart = {
      id: `Деталь ${finishedParts.length + 1}`,
      config: { ...dxfConfig },
      createdAt: new Date(),
    };

    setFinishedParts([...finishedParts, newPart]);
    setDxfConfig(createDefaultDxfConfig());
    setIsCreatingNew(true);
    setSelectedPartId(null);

    toast({
      title: "Деталь добавлена",
      description: `Артикул: ${newPart.id}`,
    });
  };

  const handleSelectPart = (partId: string) => {
    setSelectedPartId(partId);
    setIsCreatingNew(false);
  };

  const handleDeletePart = (partId: string) => {
    setFinishedParts(finishedParts.filter((p) => p.id !== partId));
    if (selectedPartId === partId) {
      setSelectedPartId(null);
      setIsCreatingNew(true);
    }
    toast({
      title: "Деталь удалена",
    });
  };

  const handleEditPart = (partId: string) => {
    const part = finishedParts.find((p) => p.id === partId);
    if (part) {
      setDxfConfig({ ...part.config });
      setSelectedPartId(partId);
      setIsCreatingNew(false);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedPartId) return;

    const price = calculateDxfPrice(dxfConfig.vectorLength);
    setFinishedParts(
      finishedParts.map((part) =>
        part.id === selectedPartId
          ? { ...part, config: { ...dxfConfig, price } }
          : part
      )
    );

    toast({
      title: "Изменения сохранены",
    });

    setSelectedPartId(null);
    setIsCreatingNew(true);
    setDxfConfig(createDefaultDxfConfig());
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedPartId(null);
    setDxfConfig(createDefaultDxfConfig());
  };

  const getDisplayConfig = (): DxfConfig | null => {
    if (selectedPartId && !isCreatingNew) {
      const part = finishedParts.find((p) => p.id === selectedPartId);
      return part ? part.config : null;
    }
    return dxfConfig.fileName ? dxfConfig : null;
  };

  const displayConfig = getDisplayConfig();
  const totalPrice = finishedParts.reduce((sum, part) => sum + part.config.price, 0);

  return (
    <div className="h-screen flex flex-col">
      <MainNav />

      {/* Основной контент */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-4 p-4">
          {/* Left Column - Configurator */}
          <div className="w-80 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base">
                  {isCreatingNew ? "Новая деталь" : "Редактирование"}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4 space-y-4">
                {isCreatingNew ? (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold mb-3">Загрузка файла</h3>
                      <DxfUploader onFileLoaded={handleFileLoaded} />
                    </div>

                    {dxfConfig.fileName && (
                      <>
                        <MaterialSelector
                          selectedMaterial={dxfConfig.material}
                          selectedThickness={dxfConfig.thickness}
                          onMaterialChange={handleMaterialChange}
                          onThicknessChange={handleThicknessChange}
                        />

                        <Button onClick={handleFinishPart} className="w-full">
                          Готова деталь
                        </Button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-2 text-xs p-3 bg-muted/50 rounded-md">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Артикул:</span>
                        <span className="font-medium">{selectedPartId}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Файл:</span>
                        <span className="font-medium truncate ml-2">{dxfConfig.fileName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Длина реза:</span>
                        <span className="font-medium">
                          {dxfConfig.vectorLength.toFixed(2)} м
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Стоимость:</span>
                        <span className="font-bold text-primary">
                          {dxfConfig.price.toFixed(2)} ₽
                        </span>
                      </div>
                    </div>

                    <MaterialSelector
                      selectedMaterial={dxfConfig.material}
                      selectedThickness={dxfConfig.thickness}
                      onMaterialChange={handleMaterialChange}
                      onThicknessChange={handleThicknessChange}
                    />

                    <div className="space-y-2">
                      <Button onClick={handleSaveEdit} className="w-full">
                        Сохранить изменения
                      </Button>
                      <Button
                        onClick={handleCreateNew}
                        variant="outline"
                        className="w-full"
                      >
                        Создать новую деталь
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Center Column - Viewer */}
          <div className="flex-1 flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">Предварительный просмотр</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 flex flex-col gap-4">
                {displayConfig && displayConfig.fileContent ? (
                  <Tabs defaultValue="preview" className="flex-1 flex flex-col min-h-0">
                    <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                      <TabsTrigger value="preview">Предпросмотр</TabsTrigger>
                      <TabsTrigger value="nesting">Раскрой</TabsTrigger>
                    </TabsList>

                    <TabsContent value="preview" className="flex-1 flex flex-col gap-4 mt-4 min-h-0 data-[state=inactive]:hidden">
                      <div className="space-y-2 text-xs p-3 bg-muted/50 rounded-md flex-shrink-0">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Файл:</span>
                          <span className="font-medium truncate ml-2">{displayConfig.fileName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Длина реза:</span>
                          <span className="font-medium">
                            {displayConfig.vectorLength.toFixed(2)} м
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 mt-2 border-t">
                          <span className="text-muted-foreground text-sm">Стоимость резки:</span>
                          <span className="font-bold text-primary text-2xl">
                            {displayConfig.price.toFixed(2)} ₽
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 flex items-center justify-center min-h-0 overflow-auto">
                        <DxfViewer
                          fileContent={displayConfig.fileContent}
                          fileName={displayConfig.fileName}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="nesting" className="flex-1 flex flex-col gap-2 mt-4 min-h-0 data-[state=inactive]:hidden">
                      {nestingResults.length > 0 && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm text-muted-foreground">Вариант раскроя:</span>
                          <Select
                            value={selectedNestingVariant.toString()}
                            onValueChange={(value) => setSelectedNestingVariant(parseInt(value))}
                          >
                            <SelectTrigger className="w-[240px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {nestingResults.map((result, index) => (
                                <SelectItem key={index} value={index.toString()}>
                                  Вариант {index + 1} - Эффективность: {result.efficiency.toFixed(1)}%
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <NestingViewer
                          nestingResults={nestingResults}
                          selectedVariant={selectedNestingVariant}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
                    <p>Загрузите DXF файл для предварительного просмотра</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Finished Parts List */}
          <div className="w-80 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Готовые детали
                  <Badge variant="secondary" className="ml-auto">{finishedParts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-4">
                {finishedParts.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    <p>Нет готовых деталей</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {finishedParts.map((part) => (
                      <Card
                        key={part.id}
                        className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                          selectedPartId === part.id && !isCreatingNew
                            ? "ring-2 ring-primary bg-primary/5"
                            : "hover:bg-accent"
                        }`}
                        onClick={() => handleSelectPart(part.id)}
                      >
                        <div className="space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <Badge 
                                variant={selectedPartId === part.id && !isCreatingNew ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {part.id}
                              </Badge>
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {part.config.fileName}
                              </div>
                            </div>
                            <div className="flex gap-1 ml-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditPart(part.id);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePart(part.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          <div className="text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Материал:</span>
                              <span>{part.config.material}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Толщина:</span>
                              <span>{part.config.thickness} мм</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Длина:</span>
                              <span>{part.config.vectorLength.toFixed(2)} м</span>
                            </div>
                            <div className="flex justify-between font-semibold pt-1 border-t">
                              <span>Цена:</span>
                              <span className="text-primary">
                                {part.config.price.toFixed(2)} ₽
                              </span>
                            </div>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer with Total */}
      {finishedParts.length > 0 && (
        <div className="border-t bg-card px-4 py-3">
          <div className="flex justify-between items-center max-w-md ml-auto">
            <span className="text-base font-semibold">Итого:</span>
            <span className="text-xl font-bold text-primary">
              {totalPrice.toFixed(2)} ₽
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

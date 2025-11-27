import { useState } from "react";
import { PipeViewer3D } from "@/components/PipeViewer3D";
import { PipeConfigurator } from "@/components/PipeConfigurator";
import { PipeConfig, FinishedPart, createDefaultConfig, calculateCutPrice } from "@/types/pipe";
import { MainNav } from "@/components/MainNav";
import { Package, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const Index = () => {
  const [pipeConfig, setPipeConfig] = useState<PipeConfig>(createDefaultConfig());
  const [finishedParts, setFinishedParts] = useState<FinishedPart[]>([]);
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(true);

  const generateArticle = () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `П-${timestamp}-${random}`;
  };

  const handleFinishPart = () => {
    const newPart: FinishedPart = {
      id: generateArticle(),
      config: { ...pipeConfig },
      createdAt: new Date(),
    };
    
    setFinishedParts([...finishedParts, newPart]);
    setSelectedPartId(newPart.id);
    setIsCreatingNew(false);
    
    // Сброс конфигурации для новой детали
    setPipeConfig(createDefaultConfig());
  };

  const handleSelectPart = (partId: string) => {
    setSelectedPartId(partId);
    setIsCreatingNew(false);
  };

  const handleCreateNew = () => {
    setSelectedPartId(null);
    setIsCreatingNew(true);
    setPipeConfig(createDefaultConfig());
  };

  // Получаем конфигурацию для отображения в 3D
  const getDisplayConfig = (): PipeConfig | null => {
    if (isCreatingNew) {
      return pipeConfig.confirmed ? pipeConfig : null;
    }
    
    const selectedPart = finishedParts.find(p => p.id === selectedPartId);
    return selectedPart?.config || null;
  };

  const displayConfig = getDisplayConfig();

  return (
    <div className="h-screen flex flex-col">
      <MainNav />

      {/* Основной контент */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-4 p-4">
          {/* Левая панель - конфигуратор */}
          <div className="w-80 flex flex-col">
            {isCreatingNew ? (
              <PipeConfigurator 
                config={pipeConfig} 
                onChange={setPipeConfig}
                onFinish={handleFinishPart}
              />
            ) : (
              <Card className="bg-card">
                <CardContent className="pt-4">
                  <div className="text-center space-y-3">
                    <Eye className="w-8 h-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Просмотр готовой детали
                    </p>
                    <button
                      onClick={handleCreateNew}
                      className="text-sm text-primary hover:underline"
                    >
                      + Создать новую деталь
                    </button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Центральная панель - 3D просмотр */}
          <div className="flex-1 flex flex-col min-w-0">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-lg">3D Просмотр</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4">
                {displayConfig ? (
                  <div className="h-full">
                    <PipeViewer3D config={displayConfig} />
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    Выберите параметры профиля и нажмите OK
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Правая панель - список готовых деталей */}
          <div className="w-80 flex flex-col">
            <Card className="flex-1 flex flex-col">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Готовые детали
                  <Badge variant="secondary" className="ml-auto">{finishedParts.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-4 pt-0">
                <ScrollArea className="h-full">
                  {finishedParts.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-8">
                      Пока нет готовых деталей
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {finishedParts.map((part) => (
                        <Card 
                          key={part.id} 
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            selectedPartId === part.id && !isCreatingNew
                              ? "ring-2 ring-primary bg-primary/5"
                              : "bg-muted/50 hover:bg-muted"
                          )}
                          onClick={() => handleSelectPart(part.id)}
                        >
                          <CardContent className="p-3 space-y-1">
                            <div className="flex items-center justify-between">
                              <Badge 
                                variant={selectedPartId === part.id && !isCreatingNew ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {part.id}
                              </Badge>
                              {selectedPartId === part.id && !isCreatingNew && (
                                <Eye className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            <div className="text-xs space-y-0.5">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Форма:</span>
                                <span className="font-medium">{part.config.shape}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Размер:</span>
                                <span className="font-medium">{part.config.size}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Длина:</span>
                                <span className="font-medium">{part.config.dimensions.length} мм</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Срезы:</span>
                                <span className="font-medium text-right">
                                  {part.config.edgeCuts.left === "Угловой срез 45°" ? "45°" : "90°"}
                                  {" / "}
                                  {part.config.edgeCuts.right === "Угловой срез 45°" ? "45°" : "90°"}
                                </span>
                              </div>
                              <div className="flex justify-between pt-1 border-t border-border mt-1">
                                <span className="text-muted-foreground">Цена резки:</span>
                                <span className="font-bold text-primary">
                                  {calculateCutPrice(part.config).toFixed(2)} ₽
                                </span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;

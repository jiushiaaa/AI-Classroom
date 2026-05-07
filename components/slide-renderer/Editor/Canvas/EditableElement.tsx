import { useMemo } from 'react';
import { ElementTypes, type PPTElement } from '@/lib/types/slides';
import { ImageElement } from '../../components/element/ImageElement';
import { TextElement } from '../../components/element/TextElement';
import { LineElement } from '../../components/element/LineElement';
import { ShapeElement } from '../../components/element/ShapeElement';
import { ChartElement } from '../../components/element/ChartElement';
import { LatexElement } from '../../components/element/LatexElement';
import { TableElement } from '../../components/element/TableElement';
import { VideoElement } from '../../components/element/VideoElement';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ElementOrderCommands, ElementAlignCommands } from '@/lib/types/edit';
import { useCanvasOperations } from '@/lib/hooks/use-canvas-operations';
import { useI18n } from '@/lib/hooks/use-i18n';
import { useImageElementActions } from './hooks/useImageElementActions';

export interface ContextmenuItem {
  text?: string;
  subText?: string;
  divider?: boolean;
  disable?: boolean;
  hide?: boolean;
  children?: ContextmenuItem[];
  handler?: () => void;
}

interface EditableElementProps {
  readonly elementInfo: PPTElement;
  readonly elementIndex: number;
  readonly isMultiSelect: boolean;
  readonly selectElement: (
    e: React.MouseEvent | React.TouchEvent,
    element: PPTElement,
    canMove?: boolean,
  ) => void;
  readonly openLinkDialog: () => void;
}

export function EditableElement({
  elementInfo,
  elementIndex,
  isMultiSelect,
  selectElement,
  openLinkDialog,
}: EditableElementProps) {
  const CurrentElementComponent = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- element components have varying prop signatures
    const elementTypeMap: Record<string, any> = {
      [ElementTypes.IMAGE]: ImageElement,
      [ElementTypes.TEXT]: TextElement,
      [ElementTypes.SHAPE]: ShapeElement,
      [ElementTypes.LINE]: LineElement,
      [ElementTypes.CHART]: ChartElement,
      [ElementTypes.LATEX]: LatexElement,
      [ElementTypes.TABLE]: TableElement,
      [ElementTypes.VIDEO]: VideoElement,
      // TODO: Add other element types
      // [ElementTypes.AUDIO]: AudioElement,
    };
    return elementTypeMap[elementInfo.type] || null;
  }, [elementInfo.type]);

  const { t } = useI18n();

  const {
    copyElement,
    pasteElement,
    cutElement,
    deleteElement,
    lockElement,
    unlockElement,
    selectAllElements,
    alignElementToCanvas,
    orderElement,
    combineElements,
    uncombineElements,
  } = useCanvasOperations();

  const imageActions = useImageElementActions(elementInfo);
  const { replaceImageInputRef, triggerImageReplace, handleReplaceImageFile, cropImage } =
    imageActions;

  const contextmenus = (): ContextmenuItem[] => {
    if (elementInfo.lock) {
      return [
        {
          text: t('editMode.contextMenu.unlock'),
          handler: () => unlockElement(elementInfo),
        },
      ];
    }

    const isImage = elementInfo.type === ElementTypes.IMAGE;

    const imageItems: ContextmenuItem[] = isImage
      ? [
          {
            text: t('editMode.contextMenu.replaceImage'),
            handler: triggerImageReplace,
          },
          {
            text: t('editMode.contextMenu.cropImage'),
            handler: cropImage,
          },
          { divider: true },
        ]
      : [];

    return [
      ...imageItems,
      {
        text: t('editMode.contextMenu.cut'),
        subText: 'Ctrl + X',
        handler: cutElement,
      },
      {
        text: t('editMode.contextMenu.copy'),
        subText: 'Ctrl + C',
        handler: copyElement,
      },
      {
        text: t('editMode.contextMenu.paste'),
        subText: 'Ctrl + V',
        handler: pasteElement,
      },
      { divider: true },
      {
        text: t('editMode.contextMenu.alignHorizontal'),
        handler: () => alignElementToCanvas(ElementAlignCommands.HORIZONTAL),
        children: [
          {
            text: t('editMode.contextMenu.alignCenter'),
            handler: () => alignElementToCanvas(ElementAlignCommands.CENTER),
          },
          {
            text: t('editMode.contextMenu.alignHorizontal'),
            handler: () => alignElementToCanvas(ElementAlignCommands.HORIZONTAL),
          },
          {
            text: t('editMode.contextMenu.alignLeft'),
            handler: () => alignElementToCanvas(ElementAlignCommands.LEFT),
          },
          {
            text: t('editMode.contextMenu.alignRight'),
            handler: () => alignElementToCanvas(ElementAlignCommands.RIGHT),
          },
        ],
      },
      {
        text: t('editMode.contextMenu.alignVertical'),
        handler: () => alignElementToCanvas(ElementAlignCommands.VERTICAL),
        children: [
          {
            text: t('editMode.contextMenu.alignCenter'),
            handler: () => alignElementToCanvas(ElementAlignCommands.CENTER),
          },
          {
            text: t('editMode.contextMenu.alignVertical'),
            handler: () => alignElementToCanvas(ElementAlignCommands.VERTICAL),
          },
          {
            text: t('editMode.contextMenu.alignTop'),
            handler: () => alignElementToCanvas(ElementAlignCommands.TOP),
          },
          {
            text: t('editMode.contextMenu.alignBottom'),
            handler: () => alignElementToCanvas(ElementAlignCommands.BOTTOM),
          },
        ],
      },
      { divider: true },
      {
        text: t('editMode.contextMenu.layerTop'),
        disable: isMultiSelect && !elementInfo.groupId,
        handler: () => orderElement(elementInfo, ElementOrderCommands.TOP),
        children: [
          {
            text: t('editMode.contextMenu.layerTop'),
            handler: () => orderElement(elementInfo, ElementOrderCommands.TOP),
          },
          {
            text: t('editMode.contextMenu.layerUp'),
            handler: () => orderElement(elementInfo, ElementOrderCommands.UP),
          },
        ],
      },
      {
        text: t('editMode.contextMenu.layerBottom'),
        disable: isMultiSelect && !elementInfo.groupId,
        handler: () => orderElement(elementInfo, ElementOrderCommands.BOTTOM),
        children: [
          {
            text: t('editMode.contextMenu.layerBottom'),
            handler: () => orderElement(elementInfo, ElementOrderCommands.BOTTOM),
          },
          {
            text: t('editMode.contextMenu.layerDown'),
            handler: () => orderElement(elementInfo, ElementOrderCommands.DOWN),
          },
        ],
      },
      { divider: true },
      {
        text: t('editMode.contextMenu.setLink'),
        handler: openLinkDialog,
        disable: true,
      },
      {
        text: elementInfo.groupId
          ? t('editMode.contextMenu.uncombine')
          : t('editMode.contextMenu.combine'),
        subText: 'Ctrl + G',
        handler: elementInfo.groupId ? uncombineElements : combineElements,
        hide: !isMultiSelect,
      },
      {
        text: t('editMode.contextMenu.selectAll'),
        subText: 'Ctrl + A',
        handler: selectAllElements,
      },
      {
        text: t('editMode.contextMenu.lock'),
        subText: 'Ctrl + L',
        handler: lockElement,
      },
      {
        text: t('editMode.contextMenu.delete'),
        subText: t('editMode.contextMenu.deleteShortcut'),
        handler: deleteElement,
      },
    ];
  };

  if (!CurrentElementComponent) {
    return (
      <div
        id={`editable-element-${elementInfo.id}`}
        className="editable-element absolute"
        style={{
          zIndex: elementIndex,
          left: elementInfo.left + 'px',
          top: elementInfo.top + 'px',
          width: elementInfo.width + 'px',
        }}
      >
        <div className="p-2 bg-gray-100 border border-gray-300 text-xs text-gray-500">
          {elementInfo.type} element (not implemented)
        </div>
      </div>
    );
  }

  return (
    <div
      id={`editable-element-${elementInfo.id}`}
      className="editable-element absolute"
      style={{
        zIndex: elementIndex,
      }}
    >
      {elementInfo.type === ElementTypes.IMAGE && (
        <input
          ref={replaceImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleReplaceImageFile}
        />
      )}
      <ContextMenu>
        <ContextMenuTrigger>
          <CurrentElementComponent elementInfo={elementInfo} selectElement={selectElement} />
        </ContextMenuTrigger>
        <ContextMenuContent>
          {contextmenus().map((item, index) => {
            if (item.divider) {
              return <ContextMenuSeparator key={index} />;
            }

            // If has children, use submenu component
            if (item.children && item.children.length > 0) {
              return (
                <ContextMenuSub key={index}>
                  <ContextMenuSubTrigger disabled={item.disable} hidden={item.hide}>
                    {item.text}
                    {item.subText && <ContextMenuShortcut>{item.subText}</ContextMenuShortcut>}
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent>
                    {item.children.map((child, childIndex) =>
                      child.divider ? (
                        <ContextMenuSeparator key={childIndex} />
                      ) : (
                        <ContextMenuItem
                          key={childIndex}
                          onClick={(e) => {
                            e.stopPropagation();
                            child.handler?.();
                          }}
                          disabled={child.disable}
                          hidden={child.hide}
                        >
                          {child.text}
                          {child.subText && (
                            <ContextMenuShortcut>{child.subText}</ContextMenuShortcut>
                          )}
                        </ContextMenuItem>
                      ),
                    )}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              );
            }

            // Regular menu item
            return (
              <ContextMenuItem
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  item.handler?.();
                }}
                disabled={item.disable}
                hidden={item.hide}
              >
                {item.text}
                {item.subText && <ContextMenuShortcut>{item.subText}</ContextMenuShortcut>}
              </ContextMenuItem>
            );
          })}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
}

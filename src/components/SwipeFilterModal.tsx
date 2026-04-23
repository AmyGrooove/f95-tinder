import { MAX_TAG_FILTERS_PER_GROUP } from "../f95/filtering";
import type { SwipeFilterOption } from "../app/swipe";

type SwipeFilterModalProps = {
  isOpen: boolean;
  isInteractionLocked: boolean;
  swipePrefixSearchText: string;
  swipeTagSearchText: string;
  filteredSwipePrefixOptions: SwipeFilterOption[];
  filteredSwipeTagOptions: SwipeFilterOption[];
  selectedSwipePrefixCount: number;
  includePrefixIds: number[];
  excludePrefixIds: number[];
  includeTagIds: number[];
  excludeTagIds: number[];
  onClose: () => void;
  onClearFilters: () => void;
  onSwipePrefixSearchTextChange: (value: string) => void;
  onSwipeTagSearchTextChange: (value: string) => void;
  onToggleSwipeIncludePrefix: (prefixId: number) => void;
  onToggleSwipeExcludePrefix: (prefixId: number) => void;
  onToggleSwipeIncludeTag: (tagId: number) => void;
  onToggleSwipeExcludeTag: (tagId: number) => void;
};

const renderSwipeFilterOptionGroup = (
  title: string,
  fieldName: string,
  options: SwipeFilterOption[],
  selectedIds: number[],
  onToggle: (id: number) => void,
  variant: "include" | "exclude",
  isDisabled = false,
  countMeta?: string,
) => {
  return (
    <div className="swipeFilterModalGroup">
      <div className="swipeFilterModalGroupHeader">
        <div>
          <div className="swipeFilterModalGroupTitle">{title}</div>
          <div className="swipeFilterModalGroupField">{fieldName}</div>
        </div>
        <div className="swipeFilterModalGroupMeta">
          {countMeta ?? `Выбрано: ${selectedIds.length}`}
        </div>
      </div>

      <div className="tagFilterChips swipeFilterModalChipGrid">
        {options.length > 0 ? (
          options.map((option) => {
            const isActive = selectedIds.includes(option.id);
            const activeClassName = isActive
              ? variant === "exclude"
                ? "tagFilterChipExcludeActive"
                : "tagFilterChipActive"
              : "";

            return (
              <button
                key={`${title}-${option.id}`}
                type="button"
                className={`tagFilterChip ${activeClassName}`}
                disabled={isDisabled}
                onClick={() => onToggle(option.id)}
              >
                {option.label}
              </button>
            );
          })
        ) : (
          <span className="smallText">Ничего не найдено</span>
        )}
      </div>
    </div>
  );
};

const SwipeFilterModal = ({
  isOpen,
  isInteractionLocked,
  swipePrefixSearchText,
  swipeTagSearchText,
  filteredSwipePrefixOptions,
  filteredSwipeTagOptions,
  selectedSwipePrefixCount,
  includePrefixIds,
  excludePrefixIds,
  includeTagIds,
  excludeTagIds,
  onClose,
  onClearFilters,
  onSwipePrefixSearchTextChange,
  onSwipeTagSearchTextChange,
  onToggleSwipeIncludePrefix,
  onToggleSwipeExcludePrefix,
  onToggleSwipeIncludeTag,
  onToggleSwipeExcludeTag,
}: SwipeFilterModalProps) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="swipeFilterModalOverlay"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose();
        }
      }}
    >
      <div className="swipeFilterModal">
        <div className="swipeFilterModalTopBar">
          <div className="swipeFilterModalIntro">
            <div className="swipeFilterModalTitle">Фильтры свайпа</div>
            <div className="swipeFilterModalMeta">
              `prefixes[]` и `noprefixes[]` без лимита. `tags[]` и `notags[]`
              до {MAX_TAG_FILTERS_PER_GROUP}.
            </div>
          </div>

          <div className="swipeFilterModalActions">
            <button
              className="button"
              type="button"
              disabled={isInteractionLocked}
              onClick={onClearFilters}
            >
              Очистить
            </button>
            <button
              className="button"
              type="button"
              disabled={isInteractionLocked}
              onClick={onClose}
            >
              Закрыть
            </button>
          </div>
        </div>

        <div className="swipeFilterModalBody">
          <div className="swipeFilterModalSection">
            <div className="swipeFilterModalSectionHeader">
              <div className="swipeFilterModalSectionTitle">Префиксы</div>
              <div className="swipeFilterModalSectionMeta">
                Выбрано: {selectedSwipePrefixCount}
              </div>
            </div>

            <div className="formRow" style={{ marginBottom: 0 }}>
              <div className="label">Поиск по префиксам</div>
              <input
                className="input"
                disabled={isInteractionLocked}
                value={swipePrefixSearchText}
                onChange={(event) =>
                  onSwipePrefixSearchTextChange(event.target.value)
                }
                placeholder="например: ren'py, unity"
              />
            </div>

            <div className="swipeFilterModalGroupGrid">
              {renderSwipeFilterOptionGroup(
                "Включить",
                "prefixes[]",
                filteredSwipePrefixOptions,
                includePrefixIds,
                onToggleSwipeIncludePrefix,
                "include",
                isInteractionLocked,
              )}
              {renderSwipeFilterOptionGroup(
                "Выключить",
                "noprefixes[]",
                filteredSwipePrefixOptions,
                excludePrefixIds,
                onToggleSwipeExcludePrefix,
                "exclude",
                isInteractionLocked,
              )}
            </div>
          </div>

          <div className="swipeFilterModalSection">
            <div className="swipeFilterModalSectionHeader">
              <div className="swipeFilterModalSectionTitle">Теги</div>
              <div className="swipeFilterModalSectionMeta">
                Включить: {includeTagIds.length}/{MAX_TAG_FILTERS_PER_GROUP} •
                Выключить: {excludeTagIds.length}/{MAX_TAG_FILTERS_PER_GROUP}
              </div>
            </div>

            <div className="formRow" style={{ marginBottom: 0 }}>
              <div className="label">Поиск по тегам</div>
              <input
                className="input"
                disabled={isInteractionLocked}
                value={swipeTagSearchText}
                onChange={(event) => onSwipeTagSearchTextChange(event.target.value)}
                placeholder="например: sandbox, corruption"
              />
            </div>

            <div className="swipeFilterModalGroupGrid">
              {renderSwipeFilterOptionGroup(
                "Включить",
                "tags[]",
                filteredSwipeTagOptions,
                includeTagIds,
                onToggleSwipeIncludeTag,
                "include",
                isInteractionLocked,
                `${includeTagIds.length}/${MAX_TAG_FILTERS_PER_GROUP}`,
              )}
              {renderSwipeFilterOptionGroup(
                "Выключить",
                "notags[]",
                filteredSwipeTagOptions,
                excludeTagIds,
                onToggleSwipeExcludeTag,
                "exclude",
                isInteractionLocked,
                `${excludeTagIds.length}/${MAX_TAG_FILTERS_PER_GROUP}`,
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { SwipeFilterModal };

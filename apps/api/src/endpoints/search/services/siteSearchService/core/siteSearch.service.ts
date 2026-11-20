import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common"
import { Types } from "mongoose"

import { CollectionRepository } from "@entities/collection/services/collectionRepository"
import { EItemField } from "@entities/item/schemas/EItemField"
import { ItemRepository } from "@entities/item/services/itemRepository"
import type { IItemPosterCard } from "@entities/item/services/itemRepository"
import { EItemType } from "@entities/item/schemas/EItemType"
import { ItemCollectionRepository } from "@entities/itemCollection/services/itemCollectionRepository"
import { ItemStatsRepository } from "@entities/itemStats/services/itemStatsRepository"
import { ELanguage } from "@entities/shared/schemas/ELanguage"
import type { EMediaType } from "@entities/shared/schemas/EMediaType"
import type { MediaSrc } from "@entities/shared/schemas/mediaSrc.schema"
import { DICTIONARY } from "@entities/shared/static/DICTIONARY"
import { filterSingleValues } from "@entities/shared/functions/filterSingleValues"
import { UserRepository } from "@entities/user/services/userRepository"
import { UserCollectionRepository } from "@entities/userCollection/services/userCollectionRepository"
import { EUserItemStatus } from "@entities/userItem/schemas/EUserItemStatus"
import { UserItemRepository } from "@entities/userItem/services/userItemRepository"
import { USER_ITEM_LIBRARY_STATUSES } from "@entities/userItem/static/USER_ITEM_LIBRARY_STATUSES"
import { AuthService } from "@endpoints/auth/services/authService"
import { SEARCH_SETTINGS } from "@endpoints/search/static/SEARCH_SETTINGS"
import { SEARCH_ITEM_FIELDS } from "@endpoints/search/static/SEARCH_ITEM_FIELDS"
import { CacheService } from "@infrastructure/cache/services/cacheService"
import { CursorService } from "@infrastructure/cache/services/cursorService"
import type { ValueFilter } from "@entities/shared/types/ValueFilter"
import { SearchService } from "@infrastructure/search/services/searchService"
import type {
  ISearchDocument,
  ISearchMatch,
} from "@infrastructure/search/services/searchService"
import { ESortDirection } from "@entities/shared/types/ESortDirection"
import { isArray } from "@shared/functions/checks/isArray"
import { isFiniteNumber } from "@shared/functions/checks/isFiniteNumber"
import { isInt } from "@shared/functions/checks/isInt"
import { isNil } from "@shared/functions/checks/isNil"
import { isUndefined } from "@shared/functions/checks/isUndefined"
import { requestContext } from "@shared/functions/context/requestContext"

import type { SearchBodyDto } from "../dto/search.body"
import type { SearchResponseDto } from "../dto/search.response"
import { ESort } from "@entities/shared/types/ESort"
import { ESearchGroup } from "../types/ESearchGroup"
import type { IItemSearchPersonalFilters } from "../types/IItemSearchPersonalFilters"
import type { IReadSearchGroupPageProps } from "../types/IReadSearchGroupPageProps"
import type { ISearchGroupOptions } from "../types/ISearchGroupOptions"
import type { ISearchGroupProps } from "../types/ISearchGroupProps"

@Injectable()
class SiteSearchService {
  constructor(
    private readonly searchService: SearchService,
    private readonly cacheService: CacheService,
    private readonly itemRepository: ItemRepository,
    private readonly userRepository: UserRepository,
    private readonly collectionRepository: CollectionRepository,
    private readonly cursorService: CursorService,
    private readonly authService: AuthService,
    private readonly userItemRepository: UserItemRepository,
    private readonly userCollectionRepository: UserCollectionRepository,
    private readonly itemStatsRepository: ItemStatsRepository,
    private readonly itemCollectionRepository: ItemCollectionRepository,
  ) {}

  async search(
    body: SearchBodyDto,
    accessToken?: unknown,
  ): Promise<SearchResponseDto> {
    const limit = body.limit ?? 20
    const isPersonalFilteringEnabled = body.isPersonalFilteringEnabled === true
    const selected = this.selectGroups(body)
    const isLatestRelease =
      selected.includes(ESearchGroup.ITEMS) &&
      body.items?.sort === ESort.LATEST_RELEASE_DATE

    if (
      body.items?.sort === ESort.LATEST_RELEASE_DATE &&
      body.items.direction === ESortDirection.ASC
    ) {
      throw new BadRequestException(
        DICTIONARY.search.invalidLatestReleaseDirection,
      )
    }

    const options = this.prepareGroups(body)
    const collectionItemId = body.collections?.itemId?.toLowerCase()
    const collectionAuthorId = body.collections?.authorId?.toLowerCase()
    const collectionFavoritedByUserId =
      body.collections?.favoritedByUserId?.toLowerCase()
    this.validateRange(body.items?.userRating)

    try {
      const viewerId = isUndefined(accessToken)
        ? undefined
        : await this.authenticateViewer(accessToken)
      const isVerifiedViewer = !isUndefined(viewerId)
      const isLegacyPersonalFilterActive =
        isVerifiedViewer && isPersonalFilteringEnabled
      const itemFilters = this.prepareItemPersonalFilters(
        isVerifiedViewer ? body.items : undefined,
        isLegacyPersonalFilterActive,
      )
      const isHiddenCollectionExcluded =
        isVerifiedViewer &&
        (body.collections?.isHiddenExcluded ?? isPersonalFilteringEnabled)
      const isFavoriteCollection =
        isVerifiedViewer && body.collections?.isFavorite === true
      if (itemFilters.statuses?.length === 0) {
        options.items.isImpossible = true
      }

      if (!isUndefined(viewerId) && body.collections?.isMine === true) {
        options.collections.filter.push(
          `authorId = ${JSON.stringify(viewerId.toHexString())}`,
        )
      }

      if (!isUndefined(collectionAuthorId)) {
        options.collections.filter.push(
          `authorId = ${JSON.stringify(collectionAuthorId)}`,
        )
      }

      const isAnyAdditionalItemFilterActive =
        itemFilters.isFavorite ||
        !isUndefined(itemFilters.isUserItemPresent) ||
        !isUndefined(itemFilters.statuses) ||
        !isUndefined(itemFilters.userRating)
      const isItemCandidatePage =
        isLatestRelease ||
        (isUndefined(body.search) && body.items?.sort === ESort.RATING) ||
        itemFilters.isCompletedOrDroppedExcluded ||
        itemFilters.isBlockedExcluded ||
        isAnyAdditionalItemFilterActive
      const isCollectionCandidatePage =
        isHiddenCollectionExcluded ||
        isFavoriteCollection ||
        !isUndefined(collectionAuthorId) ||
        !isUndefined(collectionFavoritedByUserId)
      const isItemFilterDifferentFromLegacy =
        itemFilters.isCompletedOrDroppedExcluded !==
          isLegacyPersonalFilterActive ||
        itemFilters.isBlockedExcluded !== isLegacyPersonalFilterActive ||
        isAnyAdditionalItemFilterActive
      const isCollectionFilterDifferentFromLegacy =
        isHiddenCollectionExcluded !== isLegacyPersonalFilterActive ||
        isFavoriteCollection
      const candidateGroups = new Set<ESearchGroup>([
        ...(isItemCandidatePage ? [ESearchGroup.ITEMS] : []),
        ...(isCollectionCandidatePage ? [ESearchGroup.COLLECTIONS] : []),
      ])
      const scope = [
        "search",
        body.search ?? null,
        limit,
        selected.map((group) => [group, options[group]]),
        viewerId?.toHexString() ?? null,
        isLegacyPersonalFilterActive,
        ...(selected.includes(ESearchGroup.ITEMS) &&
        isItemFilterDifferentFromLegacy
          ? [itemFilters]
          : []),
        ...(selected.includes(ESearchGroup.COLLECTIONS) &&
        isCollectionFilterDifferentFromLegacy
          ? [{ isHiddenCollectionExcluded, isFavoriteCollection }]
          : []),
        ...(selected.includes(ESearchGroup.COLLECTIONS) &&
        !isUndefined(collectionItemId)
          ? [{ collectionItemId }]
          : []),
        ...(selected.includes(ESearchGroup.COLLECTIONS) &&
        !isUndefined(collectionFavoritedByUserId)
          ? [{ collectionFavoritedByUserId }]
          : []),
      ]
      const now = Date.now()
      const position = isUndefined(body.cursor)
        ? [...(isLatestRelease ? [now] : []), ...selected.map(() => 0)]
        : this.cursorService.read({
            cursor: body.cursor,
            scope,
            invalidCursorMessage: DICTIONARY.search.invalidCursor,
            isPosition: (value): value is (number | null)[] => {
              if (
                !isArray(value) ||
                value.length !== selected.length + Number(isLatestRelease)
              ) {
                return false
              }

              const offsets = isLatestRelease ? value.slice(1) : value

              return (
                (!isLatestRelease ||
                  (isInt(value[0]) && value[0] > 0 && value[0] <= now)) &&
                offsets.some((offset) => !isNil(offset)) &&
                offsets.every(
                  (offset, index) =>
                    offset === null ||
                    (isInt(offset) &&
                      offset > 0 &&
                      offset < SEARCH_SETTINGS.maxTotalHits &&
                      (candidateGroups.has(selected[index]) ||
                        offset % limit === 0)),
                )
              )
            },
          })
      const cutoff = isLatestRelease ? position[0] : null
      const offsets = new Map(
        selected.map((group, index) => [
          group,
          position[index + Number(isLatestRelease)],
        ]),
      )

      const collectionOptions =
        isNil(offsets.get(ESearchGroup.COLLECTIONS)) ||
        options.collections.isImpossible === true
          ? options.collections
          : await this.applyCollectionIdFilters({
              options: options.collections,
              itemId: collectionItemId,
              favoritedByUserId: collectionFavoritedByUserId,
            })

      const isAnyGroupActive = selected.some(
        (group) =>
          !isNil(offsets.get(group)) &&
          (group === ESearchGroup.COLLECTIONS
            ? collectionOptions
            : options[group]
          ).isImpossible !== true,
      )

      if (!isAnyGroupActive) {
        return { items: [], collections: [], users: [], nextCursor: null }
      }

      const checkpoint = await this.cacheService.get<number>(
        SEARCH_SETTINGS.checkpointKey,
      )

      if (isNil(checkpoint)) {
        throw new ServiceUnavailableException(DICTIONARY.search.unavailable)
      }

      const [items, collections, users] = await Promise.all([
        this.readGroupPage({
          body,
          limit,
          group: ESearchGroup.ITEMS,
          offset: offsets.get(ESearchGroup.ITEMS),
          props: isNil(cutoff)
            ? options.items
            : {
                ...options.items,
                filter: [
                  ...options.items.filter,
                  `latestReleaseDate <= ${cutoff}`,
                ],
              },
          isCandidatePage: candidateGroups.has(ESearchGroup.ITEMS),
          load: (ids) =>
            this.loadItems({ ids, viewerId, filters: itemFilters }),
        }),
        this.readGroupPage({
          body,
          limit,
          group: ESearchGroup.COLLECTIONS,
          offset: offsets.get(ESearchGroup.COLLECTIONS),
          props: collectionOptions,
          isCandidatePage: candidateGroups.has(ESearchGroup.COLLECTIONS),
          load: (ids) =>
            this.loadCollections({
              ids,
              authorId: collectionAuthorId,
              viewerId,
              isHiddenExcluded: isHiddenCollectionExcluded,
              isFavorite: isFavoriteCollection,
            }),
        }),
        this.readGroupPage({
          body,
          limit,
          group: ESearchGroup.USERS,
          offset: offsets.get(ESearchGroup.USERS),
          props: options.users,
          isCandidatePage: false,
          load: (ids) => this.loadUsers(ids),
        }),
      ])
      const nextByGroup = {
        items: items.nextOffset,
        collections: collections.nextOffset,
        users: users.nextOffset,
      }
      const nextOffsets = selected.map((group) => nextByGroup[group])
      const nextCursor = nextOffsets.some((offset) => !isNil(offset))
        ? this.cursorService.create({
            scope,
            position: [...(isLatestRelease ? [cutoff] : []), ...nextOffsets],
          })
        : null

      return {
        items: items.cards,
        collections: await this.enrichCollectionCards(collections.cards),
        users: users.cards,
        nextCursor,
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error
      }

      throw new ServiceUnavailableException(DICTIONARY.search.unavailable, {
        cause: error,
      })
    }
  }

  private async applyCollectionIdFilters({
    options,
    itemId,
    favoritedByUserId,
  }: {
    options: ISearchGroupOptions
    itemId?: string
    favoritedByUserId?: string
  }) {
    const [memberIds, favoriteIds] = await Promise.all([
      isUndefined(itemId)
        ? undefined
        : this.readCollectionIdsByItem(new Types.ObjectId(itemId)),
      isUndefined(favoritedByUserId)
        ? undefined
        : this.userCollectionRepository.readFavoriteCollectionIds(
            new Types.ObjectId(favoritedByUserId),
          ),
    ])
    const favoriteIdSet =
      !isUndefined(memberIds) && !isUndefined(favoriteIds)
        ? new Set(favoriteIds)
        : undefined
    const collectionIds =
      !isUndefined(memberIds) && !isUndefined(favoriteIdSet)
        ? memberIds.filter((id) => favoriteIdSet.has(id))
        : (memberIds ?? favoriteIds)

    if (isUndefined(collectionIds)) {
      return options
    }

    return collectionIds.length === 0
      ? { ...options, isImpossible: true }
      : {
          ...options,
          filter: [...options.filter, `id IN ${JSON.stringify(collectionIds)}`],
        }
  }

  private async readCollectionIdsByItem(itemId: Types.ObjectId) {
    const isAvailable = await this.itemRepository.read.checkIsExists({
      _id: itemId,
      deletedAt: null,
    })

    return isAvailable
      ? this.itemCollectionRepository.readPublicCollectionIdsByItem(itemId)
      : []
  }

  private selectGroups({ entities }: SearchBodyDto) {
    const included = [...(entities?.allOf ?? []), ...(entities?.anyOf ?? [])]

    return Object.values(ESearchGroup).filter(
      (group) =>
        (included.length === 0 || included.includes(group)) &&
        !(entities?.noneOf ?? []).includes(group),
    )
  }

  private async authenticateViewer(accessToken: unknown) {
    const payload = await this.authService.verifyAccessToken(accessToken)
    const [session, user] = await Promise.all([
      this.authService.getSession(payload),
      this.userRepository.read.findById(payload.sub, { _id: 1 }),
    ])

    if (isNil(session) || isNil(user)) {
      throw new UnauthorizedException(DICTIONARY.auth.unauthorized)
    }

    requestContext.set("userId", payload.sub)
    return user._id
  }

  private prepareGroups(
    body: SearchBodyDto,
  ): Record<ESearchGroup, ISearchGroupOptions> {
    const { items, collections, users } = body
    const itemSort = items?.sort ?? ESort.RELEVANCE
    const itemDirection =
      items?.direction ??
      (itemSort === ESort.TITLE ? ESortDirection.ASC : ESortDirection.DESC)
    const collectionSort = collections?.sort ?? ESort.RELEVANCE
    const collectionDirection =
      collections?.direction ??
      (collectionSort === ESort.TITLE
        ? ESortDirection.ASC
        : ESortDirection.DESC)
    const userSort = users?.sort ?? ESort.RELEVANCE
    const userDirection =
      users?.direction ??
      (userSort === ESort.DISPLAY_NAME
        ? ESortDirection.ASC
        : ESortDirection.DESC)
    const collectionTypes = collections?.collectionTypes

    return {
      items: {
        filter: this.createItemFilters(body.items),
        ...(itemSort === ESort.LATEST_RELEASE_DATE
          ? {
              isImpossible:
                body.items?.types?.every((type) => type === EItemType.GAME) ??
                false,
            }
          : {}),
        isAscendingRelevance:
          itemSort === ESort.RELEVANCE && itemDirection === ESortDirection.ASC,
        sort:
          itemSort === ESort.LATEST_RELEASE_DATE
            ? ["latestReleaseDate:desc", "id:asc"]
            : itemSort === ESort.TITLE
              ? [
                  `sortTitle.${items?.language ?? ELanguage.RUSSIAN}:${itemDirection}`,
                  "id:asc",
                ]
              : itemSort === ESort.RELEASE_DATE
                ? [
                    "hasReleaseDate:desc",
                    `releaseDate:${itemDirection}`,
                    "id:asc",
                  ]
                : itemSort === ESort.RATING
                  ? [
                      "hasRating:desc",
                      `ratingScore:${itemDirection}`,
                      "ratingsCount:desc",
                      "id:asc",
                    ]
                  : undefined,
      },
      collections: {
        isImpossible:
          (collectionTypes?.allOf?.length ?? 0) > 1 ||
          (collections?.tagGroups?.allOf?.length ?? 0) > 1,
        filter: [
          ...this.createValueFilters("type", collectionTypes),
          ...this.createValueFilters("tagGroup", collections?.tagGroups),
          ...(collections?.source === "site" ? ["authorId IS NULL"] : []),
          ...(collections?.source === "user" ? ["authorId IS NOT NULL"] : []),
        ],
        isAscendingRelevance:
          collectionSort === ESort.RELEVANCE &&
          collectionDirection === ESortDirection.ASC,
        sort:
          collectionSort === ESort.TITLE
            ? [
                `sortTitle.${collections?.language ?? ELanguage.RUSSIAN}:${collectionDirection}`,
                "id:asc",
              ]
            : collectionSort === ESort.UPDATED_AT
              ? [`updatedAt:${collectionDirection}`, "id:asc"]
              : collectionSort === ESort.RATING
                ? [
                    "hasRating:desc",
                    `ratingAverage:${collectionDirection}`,
                    "id:asc",
                  ]
                : undefined,
      },
      users: {
        filter: [],
        isAscendingRelevance:
          userSort === ESort.RELEVANCE && userDirection === ESortDirection.ASC,
        sort:
          userSort === ESort.DISPLAY_NAME
            ? [`sortDisplayName:${userDirection}`, "id:asc"]
            : undefined,
      },
    }
  }

  private createItemFilters(items: SearchBodyDto["items"]) {
    const isLatestRelease = items?.sort === ESort.LATEST_RELEASE_DATE
    const types = isLatestRelease
      ? (items.types ?? Object.values(EItemType)).filter(
          (type) => type !== EItemType.GAME,
        )
      : items?.types

    const durationField =
      SEARCH_ITEM_FIELDS[items?.duration?.field ?? EItemField.DURATION]

    return [
      ...(isNil(types) ? [] : [`type IN ${JSON.stringify([...types].sort())}`]),
      ...(isLatestRelease ? ["latestReleaseDate IS NOT NULL"] : []),
      ...this.createValueFilters("tagIds", items?.tags),
      ...this.createValueFilters("countryTagIds", items?.countries),
      ...this.createValueFilters("releaseStatusTagIds", items?.releaseStatuses),
      ...this.createRangeFilters("rating", items?.rating),
      ...this.createRangeFilters("releaseYear", items?.releaseYear),
      ...this.createRangeFilters(`fields.${durationField}`, items?.duration),
    ]
  }

  private validateRange(range?: { min?: number; max?: number }) {
    if (isUndefined(range)) {
      return
    }

    const { min, max } = range
    if (
      (isNil(min) && isNil(max)) ||
      (!isNil(min) && !isNil(max) && min > max)
    ) {
      throw new BadRequestException(DICTIONARY.search.invalidFilters)
    }
  }

  private createRangeFilters(
    attribute: string,
    range?: { min?: number; max?: number },
  ) {
    this.validateRange(range)
    if (isUndefined(range)) {
      return []
    }

    return [
      `${attribute} IS NOT NULL`,
      ...(isNil(range.min) ? [] : [`${attribute} >= ${range.min}`]),
      ...(isNil(range.max) ? [] : [`${attribute} <= ${range.max}`]),
    ]
  }

  private prepareItemPersonalFilters(
    items: SearchBodyDto["items"],
    isLegacyPersonalFilterActive: boolean,
  ): IItemSearchPersonalFilters {
    const { statuses, isUserItemPresent, userRating } = items ?? {}
    const libraryStatuses = [...USER_ITEM_LIBRARY_STATUSES, "outside"] as const
    const allowedStatuses = filterSingleValues(libraryStatuses, statuses)

    return {
      isCompletedOrDroppedExcluded:
        items?.isCompletedOrDroppedExcluded ?? isLegacyPersonalFilterActive,
      isBlockedExcluded:
        items?.isBlockedExcluded ?? isLegacyPersonalFilterActive,
      isFavorite: items?.isFavorite === true,
      isUserItemPresent,
      statuses:
        allowedStatuses.length === libraryStatuses.length
          ? undefined
          : allowedStatuses,
      userRating: isUndefined(userRating)
        ? undefined
        : { min: userRating.min, max: userRating.max },
    }
  }

  private createValueFilters(attribute: string, filter?: ValueFilter<string>) {
    const normalize = (values: readonly string[]) =>
      values.map((value) => value.toLowerCase()).sort()

    return [
      ...normalize(filter?.allOf ?? []).map(
        (value) => `${attribute} = ${JSON.stringify(value)}`,
      ),
      ...(isNil(filter?.anyOf)
        ? []
        : [`${attribute} IN ${JSON.stringify(normalize(filter.anyOf))}`]),
      ...(isNil(filter?.noneOf)
        ? []
        : [`${attribute} NOT IN ${JSON.stringify(normalize(filter.noneOf))}`]),
    ]
  }

  private async readGroupPage<TCard extends { id: string }>(
    page: IReadSearchGroupPageProps<TCard>,
  ): Promise<{ cards: TCard[]; nextOffset: number | null }> {
    const { body, group, offset, props, isCandidatePage, limit, load } = page
    if (isNil(offset) || props.isImpossible === true) {
      return { cards: [], nextOffset: null }
    }

    const size = isCandidatePage ? SEARCH_SETTINGS.candidatePageSize : limit
    const hits = await this.searchGroup(
      { body, group, offset, props },
      Math.min(size + 1, SEARCH_SETTINGS.maxTotalHits - offset),
    )
    const ids = hits.slice(0, size).map((hit) => hit.id)
    const cards = await load(ids)
    const visible = cards.slice(0, limit)
    const consumed =
      isCandidatePage && visible.length === limit
        ? ids.indexOf(visible[visible.length - 1].id) + 1
        : ids.length

    return {
      cards: visible,
      nextOffset: consumed < hits.length ? offset + consumed : null,
    }
  }

  private async searchGroup(props: ISearchGroupProps, limit: number) {
    const { body, group, offset, props: options } = props

    const index = SEARCH_SETTINGS.indexes[group]
    const query = body.search ?? ""

    if (!options.isAscendingRelevance) {
      const result = await this.searchService.search<ISearchDocument>(
        index,
        query,
        {
          filter: options.filter,
          sort: options.sort,
          offset,
          limit,
          attributesToRetrieve: ["id"],
          matchingStrategy: "last",
        },
      )

      return result.hits
    }

    let ranked: ISearchMatch[] = []

    for await (const batch of this.searchService.iterateMatches({
      index,
      query,
      filter: options.filter,
      batchSize: SEARCH_SETTINGS.batchSize,
    })) {
      if (batch.some((hit) => !isFiniteNumber(hit._rankingScore))) {
        throw new ServiceUnavailableException(DICTIONARY.search.unavailable)
      }

      ranked = [...ranked, ...batch]
        .sort((first, second) => {
          const difference = first._rankingScore - second._rankingScore

          return difference !== 0
            ? difference
            : first.id.localeCompare(second.id)
        })
        .slice(0, offset + limit)
    }

    return ranked.slice(offset)
  }

  private async loadItems({
    ids,
    viewerId,
    filters,
  }: {
    ids: string[]
    viewerId?: Types.ObjectId
    filters: IItemSearchPersonalFilters
  }): Promise<SearchResponseDto["items"]> {
    if (ids.length === 0) {
      return []
    }

    const itemIds = ids.map((id) => new Types.ObjectId(id))
    const [cards, userItems, stats] = await Promise.all([
      this.itemRepository.readPosterCardsByIds(itemIds),
      !isUndefined(viewerId)
        ? this.userItemRepository.read.findMany(
            { user: viewerId, item: { $in: itemIds } },
            { _id: 0, item: 1, status: 1, rating: 1, isFavorite: 1 },
          )
        : [],
      this.itemStatsRepository.read.findMany(
        { item: { $in: itemIds } },
        { _id: 0, item: 1, ratingAverage: 1 },
      ),
    ])
    const userItemsById = new Map(
      userItems.map((item) => [String(item.item), item]),
    )
    const ratingsById = new Map(
      stats.map((item) => [String(item.item), item.ratingAverage]),
    )

    return cards.flatMap((item) => {
      const card = this.mapItem(item)
      const userItem = userItemsById.get(card.id)
      const status = userItem?.status
      const userStatus =
        USER_ITEM_LIBRARY_STATUSES.find(
          (libraryStatus) => libraryStatus === status,
        ) ?? null
      const userRating =
        status === EUserItemStatus.SKIPPED ? null : (userItem?.rating ?? null)
      if (
        (filters.isCompletedOrDroppedExcluded &&
          (status === EUserItemStatus.COMPLETED ||
            status === EUserItemStatus.DROPPED)) ||
        (filters.isBlockedExcluded && status === EUserItemStatus.BLOCKED) ||
        (filters.isFavorite && userItem?.isFavorite !== true) ||
        (!isUndefined(filters.isUserItemPresent) &&
          filters.isUserItemPresent !== !isUndefined(userItem)) ||
        filters.statuses?.includes(userStatus ?? "outside") === false ||
        (!isUndefined(filters.userRating) &&
          (isNil(userRating) ||
            (!isUndefined(filters.userRating.min) &&
              userRating < filters.userRating.min) ||
            (!isUndefined(filters.userRating.max) &&
              userRating > filters.userRating.max)))
      ) {
        return []
      }

      return [
        {
          ...card,
          rating: ratingsById.get(card.id) ?? null,
          userRating,
          userStatus,
        },
      ]
    })
  }

  private async loadCollections({
    ids,
    authorId,
    viewerId,
    isHiddenExcluded,
    isFavorite,
  }: {
    ids: string[]
    authorId?: string
    viewerId?: Types.ObjectId
    isHiddenExcluded: boolean
    isFavorite: boolean
  }) {
    if (ids.length === 0) {
      return []
    }

    const collectionIds = ids.map((id) => new Types.ObjectId(id))
    const [documents, reactions] = await Promise.all([
      this.collectionRepository.read.findMany(
        {
          _id: { $in: collectionIds },
          deletedAt: null,
          ...(isUndefined(authorId)
            ? {}
            : { author: new Types.ObjectId(authorId) }),
        },
        { _id: 1, type: 1, title: 1, media: 1, author: 1 },
      ),
      isUndefined(viewerId) || (!isHiddenExcluded && !isFavorite)
        ? []
        : this.userCollectionRepository.read.findMany(
            {
              user: viewerId,
              collectionId: { $in: collectionIds },
            },
            { _id: 0, collectionId: 1, isHidden: 1, isFavorite: 1 },
          ),
    ])
    const reactionsById = new Map(
      reactions.map((reaction) => [String(reaction.collectionId), reaction]),
    )

    const visibleIds = ids.filter((id) => {
      const reaction = reactionsById.get(id)

      return (
        (!isHiddenExcluded || reaction?.isHidden !== true) &&
        (!isFavorite || reaction?.isFavorite === true)
      )
    })

    return this.orderCards(visibleIds, documents).map((collection) => ({
      id: String(collection._id),
      authorId: collection.author,
      type: collection.type,
      title: {
        [ELanguage.RUSSIAN]: collection.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: collection.title[ELanguage.ENGLISH],
      },
      media: this.mapMedia(collection.media),
    }))
  }

  private async enrichCollectionCards(
    cards: Awaited<ReturnType<SiteSearchService["loadCollections"]>>,
  ): Promise<SearchResponseDto["collections"]> {
    if (cards.length === 0) {
      return []
    }

    const collectionIds = cards.map(({ id }) => new Types.ObjectId(id))
    const authorIds = [
      ...new Set(
        cards.flatMap(({ authorId }) =>
          isNil(authorId) ? [] : [authorId.toHexString()],
        ),
      ),
    ].map((id) => new Types.ObjectId(id))
    const [authors, counts, ratings] = await Promise.all([
      authorIds.length === 0
        ? []
        : this.userRepository.read.findMany(
            { _id: { $in: authorIds } },
            { _id: 1, avatarUrl: 1, displayName: 1 },
          ),
      this.collectionRepository.readAvailableItemCountsByIds(collectionIds),
      this.collectionRepository.readRatingAveragesByIds(collectionIds),
    ])
    const authorsById = new Map(
      authors.map((author) => [String(author._id), author]),
    )
    const countsById = new Map(
      counts.map(({ _id, itemCount }) => [String(_id), itemCount]),
    )

    return cards.map(({ authorId, ...card }) => {
      const author = authorsById.get(String(authorId))

      return {
        ...card,
        author: isNil(author)
          ? null
          : {
              id: String(author._id),
              avatar: author.avatarUrl ?? null,
              displayName: author.displayName,
            },
        isSiteCollection: isNil(authorId),
        itemCount: countsById.get(card.id) ?? 0,
        ratingAverage: ratings.get(card.id) ?? null,
      }
    })
  }

  private async loadUsers(ids: string[]): Promise<SearchResponseDto["users"]> {
    if (ids.length === 0) {
      return []
    }

    const documents = await this.userRepository.read.findMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { _id: 1, username: 1, displayName: 1, avatarUrl: 1 },
    )

    return this.orderCards(ids, documents).map((user) => ({
      id: String(user._id),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    }))
  }

  private orderCards<T extends { _id: Types.ObjectId }>(
    ids: string[],
    documents: T[],
  ) {
    const byId = new Map(
      documents.map((document) => [String(document._id), document]),
    )

    return ids.flatMap((id) => {
      const document = byId.get(id)

      return isNil(document) ? [] : [document]
    })
  }

  private mapItem(item: IItemPosterCard) {
    return {
      id: String(item._id),
      type: item.type,
      title: {
        [ELanguage.RUSSIAN]: item.title[ELanguage.RUSSIAN],
        [ELanguage.ENGLISH]: item.title[ELanguage.ENGLISH],
      },
      media: this.mapMedia(item.media),
    }
  }

  private mapMedia<TType extends EMediaType>(
    media: (MediaSrc & { type: TType })[],
  ) {
    return media.map((entry) => ({
      src: entry.src,
      language: entry.language,
      type: entry.type,
    }))
  }
}

export { SiteSearchService }

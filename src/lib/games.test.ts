import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
    getGames,
    getAllCategories,
    getAllPublishers,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });

    describe('filtering', () => {
        async function seedCatalog(): Promise<{ cats: number[]; pubs: number[] }> {
            const cats = (
                await db
                    .insert(categories)
                    .values([
                        { name: 'Strategy', description: 'c' },
                        { name: 'Puzzle', description: 'c' },
                        { name: 'Racing', description: 'c' },
                    ])
                    .returning({ id: categories.id })
            ).map((c) => c.id);
            const pubs = (
                await db
                    .insert(publishers)
                    .values([
                        { name: 'Zeta', description: 'p' },
                        { name: 'Alpha', description: 'p' },
                    ])
                    .returning({ id: publishers.id })
            ).map((p) => p.id);
            await db.insert(games).values([
                { title: 'A', description: 'd', categoryId: cats[0], publisherId: pubs[0] },
                { title: 'B', description: 'd', categoryId: cats[1], publisherId: pubs[0] },
                { title: 'C', description: 'd', categoryId: cats[1], publisherId: pubs[1] },
                { title: 'D', description: 'd', categoryId: cats[2], publisherId: pubs[1] },
            ]);
            return { cats, pubs };
        }

        const titles = (list: { title: string }[]): string[] => list.map((g) => g.title);

        it('returns every game when no filters are given', async () => {
            await seedCatalog();
            expect(titles(await getGames(db, {}))).toEqual(['A', 'B', 'C', 'D']);
            expect(titles(await getGames(db, { categoryIds: [] }))).toEqual(['A', 'B', 'C', 'D']);
        });

        it('filters by one or more categories', async () => {
            const { cats } = await seedCatalog();
            expect(titles(await getGames(db, { categoryIds: [cats[1]] }))).toEqual(['B', 'C']);
            expect(titles(await getGames(db, { categoryIds: [cats[0], cats[2]] }))).toEqual(['A', 'D']);
        });

        it('filters by publisher', async () => {
            const { pubs } = await seedCatalog();
            expect(titles(await getGames(db, { publisherId: pubs[1] }))).toEqual(['C', 'D']);
        });

        it('combines category and publisher filters', async () => {
            const { cats, pubs } = await seedCatalog();
            expect(
                titles(await getGames(db, { categoryIds: [cats[1], cats[2]], publisherId: pubs[1] })),
            ).toEqual(['C', 'D']);
            expect(
                titles(await getGames(db, { categoryIds: [cats[0]], publisherId: pubs[1] })),
            ).toEqual([]);
        });

        it('lists categories and publishers ordered by name', async () => {
            await seedCatalog();
            expect((await getAllCategories(db)).map((c) => c.name)).toEqual(['Puzzle', 'Racing', 'Strategy']);
            expect((await getAllPublishers(db)).map((p) => p.name)).toEqual(['Alpha', 'Zeta']);
        });
    });
});

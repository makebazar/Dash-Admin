const { getProducts } = require('./src/app/clubs/[clubId]/inventory/actions');

async function test() {
    const clubId = '9'; // Save Game
    const products = await getProducts(clubId);
    console.log('Products found:', products.length);
    if (products.length > 0) {
        console.log('First product total_stock:', products[0].total_stock);
    }
}

test().catch(console.error);

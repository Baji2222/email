import {
  findOrCreateCustomer,
} from './src/services/inbound-customer.service';

async function main() {
  console.log('');
  console.log('========================================');
  console.log('INBOUND CUSTOMER TEST');
  console.log('========================================');
  console.log('');

  const result = await findOrCreateCustomer(
    'bajivali2222@gmail.com',
    'Test Customer'
  );

  console.log('Customer result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  console.log('========================================');
  console.log('RESULT');
  console.log('========================================');
  console.log('');

  if (result.created) {
    console.log('NEW CUSTOMER CREATED');
  } else {
    console.log('EXISTING CUSTOMER FOUND');
  }

  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Inbound customer test failed:');
  console.error(error);
  process.exit(1);
});
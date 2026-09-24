import {
  findMatchingActiveTicket,
} from './src/services/inbound-ticket.service';

async function main() {
  console.log('');
  console.log('========================================');
  console.log('INBOUND TICKET MATCH TEST');
  console.log('========================================');
  console.log('');

  const result = await findMatchingActiveTicket(
    null,
    'AA:BB:CC:DD:EE:FF'
  );

  console.log('Match result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('');

  console.log('========================================');
  console.log('EXPECTED RESULT');
  console.log('========================================');
  console.log('');
  console.log('NO_MATCH');
  console.log('');
  console.log(
    'Reason: There are currently no active tickets with this MAC address.'
  );
  console.log('');
}

main().catch((error) => {
  console.error('');
  console.error('Inbound ticket match test failed:');
  console.error(error);
  process.exit(1);
});
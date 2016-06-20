const spawn = require("child_process").spawn;
const ping_exec = process.env.PING_EXECUTABLE.split(" ");

const ip_re = /64 bytes from ([^:]*):/;
const mac_re_1 = /\? \([^)]*\) at ([^ ]*)/;
const mac_re_2 = /(?:[0-9]{1,3}\.){3}[0-9]{1,3}.*((?:[0-9a-f]{2}:){5}[0-9a-f]{2})/;

function get_ip_list(broadcast_ip) {
  return new Promise((resolve, reject) => {
    var output = "";
    var err = "";
    const ping = spawn(ping_exec[0], ping_exec.slice(1).concat(['-c', '5', '-i', '2', broadcast_ip]));
    ping.stdout.on('data', (data) => {
      output += data;
    });
    ping.stderr.on('data', (data) => {
      err += data;
    });
    ping.on('close', (code) => {
      if (code !== 0) {
        reject(err);
      } else {
        resolve(output);
      }
    });
  });
}

function get_mac_address(ip) {
  return new Promise((resolve, reject) => {
    var output = "";
    var err = "";
    var arp = spawn('arp', ['-n', ip]);
    arp.stdout.on('data', (data) => {
      output += data;
    });
    arp.stderr.on('data', (data) => {
      err += data;
    });
    arp.on('close', (code) => {
      var matches = output.match(mac_re_1);
      if (matches) {
        resolve(matches[1]);
      } else {
        matches = output.match(mac_re_2);
        if (matches) {
          resolve(matches[1]);
        } else {
          resolve(null);
        }
      }
    });
  });
}

function get_mac_addresses(broadcast_ip) {
  return new Promise((resolve, reject) => {
    get_ip_list(broadcast_ip)
      .then((resp) => {
        const lines = resp.split(/\r?\n/);
        var ip_addresses = new Set();
        lines.forEach((line) => {
          const matches = line.match(ip_re);
          if (matches) {
            ip_addresses.add(matches[1]);
          }
        });
        Promise.all([...ip_addresses].map((ip) => { return get_mac_address(ip); }))
          .then((macs) => {
            resolve(macs.filter((val) => {
              return (val  && val !== "(incomplete)") ? val : null;
            }));
          });
      });
  });
}

module.exports = {
  get_mac_addresses: get_mac_addresses
};
